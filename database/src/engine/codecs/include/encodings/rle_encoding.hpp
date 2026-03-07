#pragma once
// =============================================================================
// rle_encoding.hpp
// Run-Length Encoding for fixed-width integer and boolean types.
// Wire format (per block):
//   [value_width: 1 byte] repeated (value: value_width bytes)(run_len: varint)
// Supports: INT8/16/32/64, UINT8/16/32/64, BOOLEAN, DATE32, TIMESTAMP64,
//           DURATION64, ENUM (stored as UINT32 index before RLE).
// =============================================================================
#include "../codec_interface.hpp"

namespace adb { namespace codec {

class RleEncoding final : public IEncodingAlgorithm {
public:
    EncodingId  id()   const noexcept override { return EncodingId::RLE; }
    const char* name() const noexcept override { return "RLE"; }

    bool supports(DataTypeId type) const noexcept override;

    // Applicable when average run length > 2.0
    bool is_applicable(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                       const ColumnMetadata& meta) const noexcept override;

    size_t estimate_encoded_size(const uint8_t* raw, size_t byte_count,
                                 uint32_t row_count,
                                 const ColumnMetadata& meta) const noexcept override;

    void encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                const ColumnMetadata& meta, EncodedBlock& out) const override;

    void decode(const EncodedBlock& block, const ColumnMetadata& meta,
                std::vector<uint8_t>& out_buf) const override;

private:
    // Returns number of unique run boundaries for sampling
    size_t count_runs(const uint8_t* raw, size_t byte_count, uint32_t vw) const noexcept;
};

}} // namespace adb::codec
