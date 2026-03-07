// =============================================================================
// dictionary_encoding.cpp
// =============================================================================
#include "../include/encodings/dictionary_encoding.hpp"
#include <cstring>
#include <algorithm>

namespace adb { namespace codec {

// ── Helpers ───────────────────────────────────────────────────────────────────

std::vector<std::vector<uint8_t>> DictionaryEncoding::parse_varbytes(
    const uint8_t* raw, size_t byte_count, uint32_t row_count)
{
    std::vector<std::vector<uint8_t>> result;
    result.reserve(row_count);
    size_t pos = 0;
    for (uint32_t i = 0; i < row_count; ++i) {
        if (pos + 4 > byte_count) throw EncodingError("DICT: truncated entry length at row " + std::to_string(i));
        uint32_t len = util::read_u32_le(raw + pos); pos += 4;
        if (pos + len > byte_count) throw EncodingError("DICT: truncated entry data at row " + std::to_string(i));
        result.push_back(std::vector<uint8_t>(raw + pos, raw + pos + len));
        pos += len;
    }
    return result;
}

std::vector<uint8_t> DictionaryEncoding::serialize_dict(
    const std::vector<std::vector<uint8_t>>& dict)
{
    std::vector<uint8_t> out;
    // entry_count (4 bytes)
    uint32_t n = static_cast<uint32_t>(dict.size());
    uint8_t tmp[4];
    util::write_u32_le(tmp, n);
    for (int b = 0; b < 4; ++b) out.push_back(tmp[b]);
    for (auto& entry : dict) {
        uint32_t len = static_cast<uint32_t>(entry.size());
        util::write_u32_le(tmp, len);
        for (int b = 0; b < 4; ++b) out.push_back(tmp[b]);
        for (uint8_t byte : entry) out.push_back(byte);
    }
    return out;
}

size_t DictionaryEncoding::deserialize_dict(const uint8_t* src, size_t size,
                                             size_t offset,
                                             std::vector<std::vector<uint8_t>>& dict)
{
    if (offset + 4 > size) throw DecodingError("DICT: truncated dict header");
    uint32_t n = util::read_u32_le(src + offset); offset += 4;
    dict.reserve(n);
    for (uint32_t i = 0; i < n; ++i) {
        if (offset + 4 > size) throw DecodingError("DICT: truncated entry length");
        uint32_t len = util::read_u32_le(src + offset); offset += 4;
        if (offset + len > size) throw DecodingError("DICT: truncated entry data");
        dict.push_back(std::vector<uint8_t>(src + offset, src + offset + len));
        offset += len;
    }
    return offset;
}

uint8_t DictionaryEncoding::index_width_for(uint32_t dict_size) noexcept {
    if (dict_size <= 255)   return 1;
    if (dict_size <= 65535) return 2;
    return 4;
}

// ── DICTIONARY ────────────────────────────────────────────────────────────────

bool DictionaryEncoding::supports(DataTypeId type) const noexcept {
    switch (type) {
        case DataTypeId::UTF8: case DataTypeId::LARGE_UTF8: case DataTypeId::ENUM:
        case DataTypeId::BINARY: case DataTypeId::INT32: case DataTypeId::INT64:
        case DataTypeId::INET:
            return true;
        default: return false;
    }
}

bool DictionaryEncoding::is_applicable(const uint8_t* raw, size_t byte_count,
                                        uint32_t row_count,
                                        const ColumnMetadata& meta) const noexcept {
    if (!raw || row_count == 0) return false;
    // Use known distinct_count if available
    if (meta.distinct_count >= 0) {
        double selectivity = static_cast<double>(meta.distinct_count)
                           / static_cast<double>(row_count);
        return selectivity < 0.5;
    }
    return true; // assume beneficial if cardinality unknown
}

size_t DictionaryEncoding::estimate_encoded_size(const uint8_t* raw, size_t byte_count,
                                                   uint32_t row_count,
                                                   const ColumnMetadata& meta) const noexcept {
    if (meta.distinct_count < 0) return byte_count; // unknown
    uint32_t dc = static_cast<uint32_t>(meta.distinct_count);
    uint8_t iw = index_width_for(dc);
    size_t dict_size = 4 + dc * (4 + static_cast<size_t>(meta.avg_value_size));
    size_t index_size = static_cast<size_t>(row_count) * iw;
    return 4 + dict_size + 1 + index_size; // header + dict + iw byte + indices
}

void DictionaryEncoding::encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                                  const ColumnMetadata& meta, EncodedBlock& out) const
{
    // Parse variable-length entries from raw buffer
    std::vector<std::vector<uint8_t>> entries = parse_varbytes(raw, byte_count, row_count);

    // Build dictionary (preserves insertion order for stable encoding)
    std::vector<std::vector<uint8_t>> dict;
    std::unordered_map<std::string, uint32_t> dict_map;
    dict_map.reserve(entries.size());

    std::vector<uint32_t> indices(row_count);
    for (uint32_t i = 0; i < row_count; ++i) {
        std::string key(reinterpret_cast<const char*>(entries[i].data()), entries[i].size());
        auto it = dict_map.find(key);
        if (it == dict_map.end()) {
            uint32_t idx = static_cast<uint32_t>(dict.size());
            if (idx > 16777215u) throw EncodingError("DICT: dictionary exceeds 16M entries");
            dict_map[key] = idx;
            dict.push_back(entries[i]);
            indices[i] = idx;
        } else {
            indices[i] = it->second;
        }
    }

    uint8_t iw = index_width_for(static_cast<uint32_t>(dict.size()));

    // Serialize: [dict bytes] [iw(1)] [index array]
    std::vector<uint8_t> buf = serialize_dict(dict);
    buf.push_back(iw);
    for (uint32_t i = 0; i < row_count; ++i) {
        uint32_t idx = indices[i];
        for (uint8_t b = 0; b < iw; ++b)
            buf.push_back(static_cast<uint8_t>((idx >> (b * 8)) & 0xFF));
    }

    out.encoding_id  = EncodingId::DICTIONARY;
    out.row_count    = row_count;
    out.encoded_size = static_cast<uint32_t>(buf.size());
    out.data         = std::move(buf);
}

void DictionaryEncoding::decode(const EncodedBlock& block, const ColumnMetadata& meta,
                                  std::vector<uint8_t>& out_buf) const
{
    const uint8_t* src  = block.data.data();
    size_t         size = block.data.size();

    std::vector<std::vector<uint8_t>> dict;
    size_t pos = deserialize_dict(src, size, 0, dict);

    if (pos >= size) throw DecodingError("DICT: missing index_width byte");
    uint8_t iw = src[pos++];
    if (iw != 1 && iw != 2 && iw != 4) throw DecodingError("DICT: invalid index_width=" + std::to_string(iw));

    size_t needed = pos + static_cast<size_t>(block.row_count) * iw;
    if (size < needed) throw DecodingError("DICT: truncated index array");

    // Reconstruct: output is [len(4)][bytes]... for each row
    out_buf.clear();
    for (uint32_t i = 0; i < block.row_count; ++i) {
        uint32_t idx = 0;
        for (uint8_t b = 0; b < iw; ++b)
            idx |= (static_cast<uint32_t>(src[pos++]) << (b * 8));
        if (idx >= dict.size()) throw DecodingError("DICT: index out of range: " + std::to_string(idx));
        const auto& entry = dict[idx];
        uint32_t len = static_cast<uint32_t>(entry.size());
        uint8_t tmp[4];
        util::write_u32_le(tmp, len);
        for (int b = 0; b < 4; ++b) out_buf.push_back(tmp[b]);
        for (uint8_t byte : entry) out_buf.push_back(byte);
    }
}

// ── RLE_DICTIONARY ────────────────────────────────────────────────────────────

bool RleDictionaryEncoding::supports(DataTypeId type) const noexcept {
    switch (type) {
        case DataTypeId::UTF8: case DataTypeId::LARGE_UTF8: case DataTypeId::ENUM:
        case DataTypeId::INT32: case DataTypeId::INT64: case DataTypeId::INET:
            return true;
        default: return false;
    }
}

bool RleDictionaryEncoding::is_applicable(const uint8_t* raw, size_t byte_count,
                                           uint32_t row_count,
                                           const ColumnMetadata& meta) const noexcept {
    if (!raw || row_count < 2) return false;
    if (meta.distinct_count >= 0 && meta.distinct_count > static_cast<int64_t>(row_count / 2))
        return false;
    return true;
}

size_t RleDictionaryEncoding::estimate_encoded_size(const uint8_t* raw, size_t byte_count,
                                                     uint32_t row_count,
                                                     const ColumnMetadata& meta) const noexcept {
    // Dictionary section (same as DICT) + typically much smaller RLE index
    int64_t dc = meta.distinct_count >= 0 ? meta.distinct_count : (int64_t)(row_count / 4);
    size_t dict_size = 4 + static_cast<size_t>(dc) * (4 + static_cast<size_t>(meta.avg_value_size));
    size_t rle_size  = static_cast<size_t>(dc) * 4; // rough: dc unique runs × 4 bytes
    return dict_size + 1 + rle_size;
}

void RleDictionaryEncoding::encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                                    const ColumnMetadata& meta, EncodedBlock& out) const
{
    // Re-use DictionaryEncoding to get dict + index, then RLE the indices.
    // Step 1: Build dict + indices
    std::vector<std::vector<uint8_t>> entries = DictionaryEncoding::parse_varbytes(raw, byte_count, row_count);
    std::vector<std::vector<uint8_t>> dict;
    std::unordered_map<std::string, uint32_t> dict_map;
    std::vector<uint32_t> indices(row_count);
    for (uint32_t i = 0; i < row_count; ++i) {
        std::string key(reinterpret_cast<const char*>(entries[i].data()), entries[i].size());
        auto it = dict_map.find(key);
        if (it == dict_map.end()) {
            uint32_t idx = static_cast<uint32_t>(dict.size());
            dict_map[key] = idx;
            dict.push_back(entries[i]);
            indices[i] = idx;
        } else {
            indices[i] = it->second;
        }
    }

    uint8_t iw = DictionaryEncoding::index_width_for(static_cast<uint32_t>(dict.size()));
    std::vector<uint8_t> buf = DictionaryEncoding::serialize_dict(dict);
    buf.push_back(iw);

    // Step 2: RLE the index array
    // Format: (index_value: iw bytes)(run_len: varint)...
    uint8_t varint_tmp[10];
    uint32_t cur_idx  = indices[0];
    uint64_t run_len  = 1;
    for (uint32_t i = 1; i <= row_count; ++i) {
        bool same = (i < row_count) && (indices[i] == cur_idx);
        if (!same) {
            for (uint8_t b = 0; b < iw; ++b)
                buf.push_back(static_cast<uint8_t>((cur_idx >> (b*8)) & 0xFF));
            size_t vn = util::write_varint(varint_tmp, run_len);
            for (size_t b = 0; b < vn; ++b) buf.push_back(varint_tmp[b]);
            if (i < row_count) { cur_idx = indices[i]; run_len = 1; }
        } else {
            ++run_len;
        }
    }

    out.encoding_id  = EncodingId::RLE_DICTIONARY;
    out.row_count    = row_count;
    out.encoded_size = static_cast<uint32_t>(buf.size());
    out.data         = std::move(buf);
}

void RleDictionaryEncoding::decode(const EncodedBlock& block, const ColumnMetadata& meta,
                                    std::vector<uint8_t>& out_buf) const
{
    const uint8_t* src  = block.data.data();
    size_t         size = block.data.size();

    std::vector<std::vector<uint8_t>> dict;
    size_t pos = DictionaryEncoding::deserialize_dict(src, size, 0, dict);

    if (pos >= size) throw DecodingError("RLE_DICT: missing index_width");
    uint8_t iw = src[pos++];
    if (iw != 1 && iw != 2 && iw != 4) throw DecodingError("RLE_DICT: invalid iw");

    out_buf.clear();
    uint32_t reconstructed = 0;
    while (pos < size && reconstructed < block.row_count) {
        if (pos + iw > size) throw DecodingError("RLE_DICT: truncated index value");
        uint32_t idx = 0;
        for (uint8_t b = 0; b < iw; ++b)
            idx |= (static_cast<uint32_t>(src[pos++]) << (b*8));
        size_t bytes_read = 0;
        uint64_t run_len = util::read_varint(src + pos, size - pos, &bytes_read);
        if (bytes_read == 0) throw DecodingError("RLE_DICT: invalid varint");
        pos += bytes_read;

        if (idx >= dict.size()) throw DecodingError("RLE_DICT: index out of range");
        const auto& entry = dict[idx];
        uint32_t elen = static_cast<uint32_t>(entry.size());
        uint8_t tmp[4];
        util::write_u32_le(tmp, elen);
        for (uint64_t r = 0; r < run_len && reconstructed < block.row_count; ++r, ++reconstructed) {
            for (int b = 0; b < 4; ++b) out_buf.push_back(tmp[b]);
            for (uint8_t byte : entry) out_buf.push_back(byte);
        }
    }

    if (reconstructed != block.row_count) {
        throw DecodingError("RLE_DICT: decoded " + std::to_string(reconstructed)
            + " rows, expected " + std::to_string(block.row_count));
    }
}

}} // namespace adb::codec
