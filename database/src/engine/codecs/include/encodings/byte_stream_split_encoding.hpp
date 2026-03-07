#pragma once
// =============================================================================
// byte_stream_split_encoding.hpp
// BYTE_STREAM_SPLIT for FLOAT32 and FLOAT64.
// Separates bytes by position across all values into N contiguous streams,
// then concatenates them. This groups similar-valued bytes together, making
// LZ4/ZSTD far more effective on floating-point data.
//
// Wire format for FLOAT32 (vw=4):
//   [vw(1)] [stream_0: byte0_of_val0, byte0_of_val1, ...]
//           [stream_1: byte1_of_val0, byte1_of_val1, ...]
//           [stream_2: ...]
//           [stream_3: ...]
//
// FLOAT64 produces 8 streams (vw=8).
// =============================================================================
#include "../codec_interface.hpp"

namespace adb { namespace codec {

class ByteStreamSplitEncoding final : public IEncodingAlgorithm {
public:
    EncodingId  id()   const noexcept override { return EncodingId::BYTE_STREAM_SPLIT; }
    const char* name() const noexcept override { return "BYTE_STREAM_SPLIT"; }

    bool supports(DataTypeId type) const noexcept override {
        return type == DataTypeId::FLOAT32 || type == DataTypeId::FLOAT64;
    }

    bool is_applicable(const uint8_t*, size_t, uint32_t row_count,
                       const ColumnMetadata& meta) const noexcept override {
        return supports(meta.data_type) && row_count >= 8;
    }

    size_t estimate_encoded_size(const uint8_t*, size_t byte_count,
                                 uint32_t, const ColumnMetadata&) const noexcept override {
        return 1 + byte_count; // same size + 1 header byte; compression handles the rest
    }

    void encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                const ColumnMetadata& meta, EncodedBlock& out) const override;

    void decode(const EncodedBlock& block, const ColumnMetadata& meta,
                std::vector<uint8_t>& out_buf) const override;
};

}} // namespace adb::codec
