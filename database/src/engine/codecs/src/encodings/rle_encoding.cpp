// =============================================================================
// rle_encoding.cpp
// Wire format: [value_width(1)] [value(vw) + run_len(varint)] ...
// =============================================================================
#include "../include/encodings/rle_encoding.hpp"
#include <cstring>

namespace adb { namespace codec {

bool RleEncoding::supports(DataTypeId type) const noexcept {
    switch (type) {
        case DataTypeId::INT8: case DataTypeId::INT16:
        case DataTypeId::INT32: case DataTypeId::INT64:
        case DataTypeId::UINT8: case DataTypeId::UINT16:
        case DataTypeId::UINT32: case DataTypeId::UINT64:
        case DataTypeId::BOOLEAN: case DataTypeId::DATE32:
        case DataTypeId::TIMESTAMP64: case DataTypeId::DURATION64:
        case DataTypeId::ENUM:
            return true;
        default:
            return false;
    }
}

size_t RleEncoding::count_runs(const uint8_t* raw, size_t byte_count,
                                uint32_t vw) const noexcept {
    if (!raw || byte_count == 0 || vw == 0) return 0;
    size_t row_count = byte_count / vw;
    if (row_count == 0) return 0;
    size_t runs = 1;
    for (size_t i = 1; i < row_count; ++i) {
        if (std::memcmp(raw + i * vw, raw + (i - 1) * vw, vw) != 0)
            ++runs;
    }
    return runs;
}

bool RleEncoding::is_applicable(const uint8_t* raw, size_t byte_count,
                                 uint32_t row_count,
                                 const ColumnMetadata& meta) const noexcept {
    if (!raw || row_count == 0 || byte_count == 0) return false;
    uint32_t vw = static_cast<uint32_t>(physical_byte_width(meta.data_type));
    if (vw == 0) return false; // variable-length: not applicable
    size_t runs = count_runs(raw, byte_count, vw);
    if (runs == 0) return false;
    // Applicable if average run length > 2.0
    return (static_cast<double>(row_count) / static_cast<double>(runs)) > 2.0;
}

size_t RleEncoding::estimate_encoded_size(const uint8_t* raw, size_t byte_count,
                                           uint32_t row_count,
                                           const ColumnMetadata& meta) const noexcept {
    if (!raw || row_count == 0) return byte_count;
    uint32_t vw = static_cast<uint32_t>(physical_byte_width(meta.data_type));
    if (vw == 0) return SIZE_MAX;
    size_t runs = count_runs(raw, byte_count, vw);
    // 1 byte header + runs × (vw + ~2 bytes varint)
    return 1 + runs * (vw + 2);
}

void RleEncoding::encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                          const ColumnMetadata& meta, EncodedBlock& out) const
{
    uint32_t vw = static_cast<uint32_t>(physical_byte_width(meta.data_type));
    if (vw == 0) throw EncodingError("RLE: variable-length type not supported");
    if (byte_count != static_cast<size_t>(row_count) * vw) {
        throw EncodingError("RLE: byte_count mismatch: expected "
            + std::to_string(static_cast<size_t>(row_count) * vw)
            + " got " + std::to_string(byte_count));
    }
    if (row_count == 0) {
        out.encoding_id  = EncodingId::RLE;
        out.row_count    = 0;
        out.encoded_size = 0;
        out.data.clear();
        out.data.push_back(static_cast<uint8_t>(vw)); // write value_width header
        out.encoded_size = 1;
        return;
    }

    // Worst case: every value is unique → row_count × (vw + 10) bytes + 1 header
    std::vector<uint8_t> buf;
    buf.reserve(1 + row_count * (vw + 2));
    buf.push_back(static_cast<uint8_t>(vw));

    const uint8_t* cur = raw;
    uint64_t run_len = 1;
    uint8_t  varint_tmp[10];

    for (uint32_t i = 1; i <= row_count; ++i) {
        bool same = (i < row_count) &&
                    (std::memcmp(raw + i * vw, raw + (i - 1) * vw, vw) == 0);
        if (same) {
            ++run_len;
        } else {
            // Emit (value, run_len)
            const uint8_t* val_ptr = raw + (i - 1 - (run_len - 1)) * vw;
            for (uint32_t b = 0; b < vw; ++b) buf.push_back(val_ptr[b]);
            size_t vn = util::write_varint(varint_tmp, run_len);
            for (size_t b = 0; b < vn; ++b) buf.push_back(varint_tmp[b]);
            run_len = 1;
        }
    }

    out.encoding_id  = EncodingId::RLE;
    out.row_count    = row_count;
    out.encoded_size = static_cast<uint32_t>(buf.size());
    out.data         = std::move(buf);
}

void RleEncoding::decode(const EncodedBlock& block, const ColumnMetadata& meta,
                          std::vector<uint8_t>& out_buf) const
{
    const uint8_t* src  = block.data.data();
    size_t         size = block.data.size();

    if (size < 1) throw DecodingError("RLE: empty block data");
    uint32_t vw = src[0];
    if (vw == 0 || vw > 16) {
        throw DecodingError("RLE: invalid value_width=" + std::to_string(vw));
    }
    size_t pos = 1;

    out_buf.clear();
    out_buf.reserve(static_cast<size_t>(block.row_count) * vw);

    while (pos < size) {
        if (pos + vw > size) throw DecodingError("RLE: truncated value bytes at pos=" + std::to_string(pos));
        const uint8_t* val = src + pos;
        pos += vw;

        size_t bytes_read = 0;
        uint64_t run_len = util::read_varint(src + pos, size - pos, &bytes_read);
        if (bytes_read == 0) throw DecodingError("RLE: invalid varint at pos=" + std::to_string(pos));
        pos += bytes_read;

        for (uint64_t r = 0; r < run_len; ++r) {
            for (uint32_t b = 0; b < vw; ++b) out_buf.push_back(val[b]);
        }
    }

    size_t expected = static_cast<size_t>(block.row_count) * vw;
    if (out_buf.size() != expected) {
        throw DecodingError("RLE: decoded " + std::to_string(out_buf.size())
            + " bytes, expected " + std::to_string(expected));
    }
}

}} // namespace adb::codec
