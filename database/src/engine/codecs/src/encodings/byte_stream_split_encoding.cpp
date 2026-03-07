// =============================================================================
// byte_stream_split_encoding.cpp
// =============================================================================
#include "../include/encodings/byte_stream_split_encoding.hpp"
#include <cstring>

namespace adb { namespace codec {

void ByteStreamSplitEncoding::encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                                      const ColumnMetadata& meta, EncodedBlock& out) const
{
    uint32_t vw = static_cast<uint32_t>(physical_byte_width(meta.data_type));
    if (vw == 0) throw EncodingError("BSS: unsupported type");
    if (byte_count != static_cast<size_t>(row_count) * vw) {
        throw EncodingError("BSS: byte_count mismatch");
    }

    // Output: [vw(1)] then vw streams of row_count bytes each
    std::vector<uint8_t> buf;
    buf.resize(1 + byte_count);
    buf[0] = static_cast<uint8_t>(vw);

    for (uint32_t s = 0; s < vw; ++s) {
        uint8_t* stream = buf.data() + 1 + static_cast<size_t>(s) * row_count;
        for (uint32_t r = 0; r < row_count; ++r) {
            stream[r] = raw[r * vw + s];
        }
    }

    out.encoding_id  = EncodingId::BYTE_STREAM_SPLIT;
    out.row_count    = row_count;
    out.encoded_size = static_cast<uint32_t>(buf.size());
    out.data         = std::move(buf);
}

void ByteStreamSplitEncoding::decode(const EncodedBlock& block, const ColumnMetadata& meta,
                                      std::vector<uint8_t>& out_buf) const
{
    const uint8_t* src  = block.data.data();
    size_t         size = block.data.size();
    if (size < 1) throw DecodingError("BSS: empty block");
    uint32_t vw = src[0];
    if (vw != 4 && vw != 8) throw DecodingError("BSS: invalid vw=" + std::to_string(vw));

    size_t expected = 1 + static_cast<size_t>(block.row_count) * vw;
    if (size < expected) throw DecodingError("BSS: block too small");

    out_buf.resize(static_cast<size_t>(block.row_count) * vw);

    for (uint32_t s = 0; s < vw; ++s) {
        const uint8_t* stream = src + 1 + static_cast<size_t>(s) * block.row_count;
        for (uint32_t r = 0; r < block.row_count; ++r) {
            out_buf[r * vw + s] = stream[r];
        }
    }
}

}} // namespace adb::codec
