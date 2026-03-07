// =============================================================================
// bitpacking_encoding.cpp — BIT_PACKING and FRAME_OF_REFERENCE
// =============================================================================
#include "../include/encodings/bitpacking_encoding.hpp"
#include <cstring>
#include <algorithm>
#include <limits>

namespace adb { namespace codec {

// ── BIT_PACKING ───────────────────────────────────────────────────────────────

bool BitPackingEncoding::supports(DataTypeId type) const noexcept {
    switch (type) {
        case DataTypeId::INT8:  case DataTypeId::INT16:  case DataTypeId::INT32:
        case DataTypeId::UINT8: case DataTypeId::UINT16: case DataTypeId::UINT32:
            return true;
        default: return false;
    }
}

uint32_t BitPackingEncoding::compute_bit_width(const uint8_t* raw, size_t vw,
                                                uint32_t row_count) noexcept {
    uint64_t max_val = 0;
    for (uint32_t i = 0; i < row_count; ++i) {
        uint64_t v = 0;
        std::memcpy(&v, raw + i * vw, vw);
        if (v > max_val) max_val = v;
    }
    return util::min_bits_for(max_val);
}

bool BitPackingEncoding::is_applicable(const uint8_t* raw, size_t byte_count,
                                        uint32_t row_count,
                                        const ColumnMetadata& meta) const noexcept {
    if (!raw || row_count == 0) return false;
    uint32_t vw = static_cast<uint32_t>(physical_byte_width(meta.data_type));
    if (vw == 0 || vw > 4) return false;
    uint32_t bw = compute_bit_width(raw, vw, row_count);
    return bw < (vw * 8); // beneficial only if we save bits
}

size_t BitPackingEncoding::estimate_encoded_size(const uint8_t* raw, size_t byte_count,
                                                  uint32_t row_count,
                                                  const ColumnMetadata& meta) const noexcept {
    uint32_t vw = static_cast<uint32_t>(physical_byte_width(meta.data_type));
    if (vw == 0) return SIZE_MAX;
    uint32_t bw = compute_bit_width(raw, vw, row_count);
    size_t packed_bits = static_cast<size_t>(row_count) * bw;
    return 2 + (packed_bits + 7) / 8; // 1 header + 1 bit_width byte + packed data
}

void BitPackingEncoding::pack_bits(const uint32_t* values, uint32_t row_count,
                                    uint32_t bit_width, std::vector<uint8_t>& out)
{
    if (bit_width == 0 || bit_width > 32) {
        throw EncodingError("BIT_PACKING: invalid bit_width=" + std::to_string(bit_width));
    }
    size_t total_bits = static_cast<size_t>(row_count) * bit_width;
    size_t total_bytes = (total_bits + 7) / 8;
    size_t start = out.size();
    out.resize(start + total_bytes, 0);
    uint8_t* dst = out.data() + start;

    uint64_t bit_pos = 0;
    for (uint32_t i = 0; i < row_count; ++i) {
        uint64_t v = values[i];
        for (uint32_t b = 0; b < bit_width; ++b) {
            uint64_t byte_idx = bit_pos / 8;
            uint32_t bit_idx  = static_cast<uint32_t>(bit_pos % 8);
            if ((v >> b) & 1) dst[byte_idx] |= (1u << bit_idx);
            ++bit_pos;
        }
    }
}

void BitPackingEncoding::unpack_bits(const uint8_t* packed, uint32_t row_count,
                                      uint32_t bit_width, std::vector<uint32_t>& out)
{
    if (bit_width == 0 || bit_width > 32) {
        throw DecodingError("BIT_PACKING: invalid bit_width=" + std::to_string(bit_width));
    }
    out.resize(row_count);
    uint64_t bit_pos = 0;
    for (uint32_t i = 0; i < row_count; ++i) {
        uint32_t v = 0;
        for (uint32_t b = 0; b < bit_width; ++b) {
            uint64_t byte_idx = bit_pos / 8;
            uint32_t bit_idx  = static_cast<uint32_t>(bit_pos % 8);
            if ((packed[byte_idx] >> bit_idx) & 1) v |= (1u << b);
            ++bit_pos;
        }
        out[i] = v;
    }
}

void BitPackingEncoding::encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                                 const ColumnMetadata& meta, EncodedBlock& out) const
{
    uint32_t vw = static_cast<uint32_t>(physical_byte_width(meta.data_type));
    if (vw == 0 || vw > 4) throw EncodingError("BIT_PACKING: vw must be 1-4");
    if (byte_count != static_cast<size_t>(row_count) * vw) {
        throw EncodingError("BIT_PACKING: byte_count mismatch");
    }

    uint32_t bw = compute_bit_width(raw, vw, row_count);

    std::vector<uint32_t> vals(row_count);
    for (uint32_t i = 0; i < row_count; ++i) {
        uint32_t v = 0;
        std::memcpy(&v, raw + i * vw, vw);
        vals[i] = v;
    }

    std::vector<uint8_t> buf;
    buf.reserve(2 + (static_cast<size_t>(row_count) * bw + 7) / 8);
    buf.push_back(static_cast<uint8_t>(vw));
    buf.push_back(static_cast<uint8_t>(bw));
    pack_bits(vals.data(), row_count, bw, buf);

    out.encoding_id  = EncodingId::BIT_PACKING;
    out.row_count    = row_count;
    out.encoded_size = static_cast<uint32_t>(buf.size());
    out.data         = std::move(buf);
}

void BitPackingEncoding::decode(const EncodedBlock& block, const ColumnMetadata& meta,
                                 std::vector<uint8_t>& out_buf) const
{
    const uint8_t* src = block.data.data();
    size_t size = block.data.size();
    if (size < 2) throw DecodingError("BIT_PACKING: block too small");
    uint32_t vw = src[0];
    uint32_t bw = src[1];
    if (vw == 0 || vw > 4) throw DecodingError("BIT_PACKING: invalid vw");
    if (bw == 0 || bw > 32) throw DecodingError("BIT_PACKING: invalid bw");

    std::vector<uint32_t> vals;
    unpack_bits(src + 2, block.row_count, bw, vals);

    out_buf.resize(static_cast<size_t>(block.row_count) * vw, 0);
    for (uint32_t i = 0; i < block.row_count; ++i) {
        std::memcpy(out_buf.data() + i * vw, &vals[i], vw);
    }
}

// ── FRAME_OF_REFERENCE ────────────────────────────────────────────────────────

bool ForEncoding::supports(DataTypeId type) const noexcept {
    switch (type) {
        case DataTypeId::INT8:  case DataTypeId::INT16:
        case DataTypeId::INT32: case DataTypeId::INT64:
        case DataTypeId::UINT8: case DataTypeId::UINT16:
        case DataTypeId::UINT32: case DataTypeId::UINT64:
            return true;
        default: return false;
    }
}

bool ForEncoding::is_applicable(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                                  const ColumnMetadata& meta) const noexcept {
    if (!raw || row_count == 0) return false;
    uint32_t vw = static_cast<uint32_t>(physical_byte_width(meta.data_type));
    if (vw == 0) return false;

    // Find min and max
    uint64_t mn = UINT64_MAX, mx = 0;
    for (uint32_t i = 0; i < row_count; ++i) {
        uint64_t v = 0;
        std::memcpy(&v, raw + i*vw, vw);
        if (v < mn) mn = v;
        if (v > mx) mx = v;
    }
    uint64_t range = mx - mn;
    uint32_t range_bits = util::min_bits_for(range);
    return range_bits < (vw * 8 - 1); // save at least 1 bit per value
}

size_t ForEncoding::estimate_encoded_size(const uint8_t* raw, size_t byte_count,
                                           uint32_t row_count,
                                           const ColumnMetadata& meta) const noexcept {
    uint32_t vw = static_cast<uint32_t>(physical_byte_width(meta.data_type));
    if (vw == 0) return SIZE_MAX;
    uint64_t mn = UINT64_MAX, mx = 0;
    for (uint32_t i = 0; i < row_count; ++i) {
        uint64_t v = 0;
        std::memcpy(&v, raw + i*vw, vw);
        if (v < mn) mn = v;
        if (v > mx) mx = v;
    }
    uint32_t bw = util::min_bits_for(mx - mn);
    size_t packed = (static_cast<size_t>(row_count) * bw + 7) / 8;
    return 1 + 8 + 1 + packed; // vw + min(8) + bw(1) + packed
}

void ForEncoding::encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                          const ColumnMetadata& meta, EncodedBlock& out) const
{
    uint32_t vw = static_cast<uint32_t>(physical_byte_width(meta.data_type));
    if (vw == 0) throw EncodingError("FOR: variable-length not supported");
    if (byte_count != static_cast<size_t>(row_count) * vw) {
        throw EncodingError("FOR: byte_count mismatch");
    }

    // Find min
    uint64_t mn = UINT64_MAX;
    for (uint32_t i = 0; i < row_count; ++i) {
        uint64_t v = 0;
        std::memcpy(&v, raw + i*vw, vw);
        if (v < mn) mn = v;
    }

    // Compute offsets and bit_width
    std::vector<uint32_t> offsets(row_count);
    uint64_t max_offset = 0;
    for (uint32_t i = 0; i < row_count; ++i) {
        uint64_t v = 0;
        std::memcpy(&v, raw + i*vw, vw);
        uint64_t offset = v - mn;
        if (offset > UINT32_MAX) throw EncodingError("FOR: offset exceeds UINT32 range");
        offsets[i] = static_cast<uint32_t>(offset);
        if (offset > max_offset) max_offset = offset;
    }
    uint32_t bw = util::min_bits_for(max_offset);
    if (bw == 0) bw = 1; // all values equal

    // Wire format: [vw(1)] [min(8 LE)] [bw(1)] [packed offsets]
    std::vector<uint8_t> buf;
    buf.reserve(10 + (static_cast<size_t>(row_count) * bw + 7) / 8);
    buf.push_back(static_cast<uint8_t>(vw));
    uint8_t min_bytes[8] = {};
    std::memcpy(min_bytes, &mn, sizeof(uint64_t));
    for (int b = 0; b < 8; ++b) buf.push_back(min_bytes[b]);
    buf.push_back(static_cast<uint8_t>(bw));
    BitPackingEncoding::pack_bits(offsets.data(), row_count, bw, buf);

    out.encoding_id  = EncodingId::FRAME_OF_REFERENCE;
    out.row_count    = row_count;
    out.encoded_size = static_cast<uint32_t>(buf.size());
    out.data         = std::move(buf);
}

void ForEncoding::decode(const EncodedBlock& block, const ColumnMetadata& meta,
                          std::vector<uint8_t>& out_buf) const
{
    const uint8_t* src = block.data.data();
    size_t size = block.data.size();
    if (size < 10) throw DecodingError("FOR: block too small");
    uint32_t vw = src[0];
    if (vw == 0 || vw > 8) throw DecodingError("FOR: invalid vw");
    uint64_t mn = util::read_u64_le(src + 1);
    uint32_t bw = src[9];
    if (bw == 0 || bw > 32) throw DecodingError("FOR: invalid bw");

    std::vector<uint32_t> offsets;
    BitPackingEncoding::unpack_bits(src + 10, block.row_count, bw, offsets);

    out_buf.resize(static_cast<size_t>(block.row_count) * vw, 0);
    for (uint32_t i = 0; i < block.row_count; ++i) {
        uint64_t v = mn + offsets[i];
        std::memcpy(out_buf.data() + i * vw, &v, vw);
    }
}

}} // namespace adb::codec
