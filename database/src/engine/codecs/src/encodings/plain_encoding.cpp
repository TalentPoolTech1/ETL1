// =============================================================================
// plain_encoding.cpp
// =============================================================================
#include "../include/encodings/plain_encoding.hpp"
#include <cstring>

namespace adb { namespace codec {

void PlainEncoding::encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                           const ColumnMetadata& /*meta*/, EncodedBlock& out) const
{
    out.encoding_id  = EncodingId::PLAIN;
    out.row_count    = row_count;
    out.data.resize(byte_count);
    if (byte_count > 0) {
        if (!raw) throw EncodingError("PLAIN encode: raw_data is null");
        std::memcpy(out.data.data(), raw, byte_count);
    }
    out.encoded_size = static_cast<uint32_t>(byte_count);
}

void PlainEncoding::decode(const EncodedBlock& block, const ColumnMetadata& /*meta*/,
                           std::vector<uint8_t>& out_buf) const
{
    out_buf.resize(block.encoded_size);
    if (block.encoded_size > 0) {
        if (block.data.size() < block.encoded_size) {
            throw DecodingError("PLAIN decode: data.size()=" + std::to_string(block.data.size())
                + " < encoded_size=" + std::to_string(block.encoded_size));
        }
        std::memcpy(out_buf.data(), block.data.data(), block.encoded_size);
    }
}

}} // namespace adb::codec
