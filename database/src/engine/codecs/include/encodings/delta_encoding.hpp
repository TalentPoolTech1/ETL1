#pragma once
// =============================================================================
// delta_encoding.hpp
// DELTA encoding for monotonic/slowly-changing integer and date/time columns.
// Wire format:
//   [value_width(1)] [first_value(vw LE)] [delta_1(vw LE)] ... [delta_n-1(vw LE)]
// Deltas are signed and wrap on overflow (modular arithmetic).
// Supports: INT8/16/32/64, UINT8/16/32/64, DATE32, TIMESTAMP64, DURATION64
// =============================================================================
#include "../codec_interface.hpp"

namespace adb { namespace codec {

class DeltaEncoding final : public IEncodingAlgorithm {
public:
    EncodingId  id()   const noexcept override { return EncodingId::DELTA; }
    const char* name() const noexcept override { return "DELTA"; }

    bool supports(DataTypeId type) const noexcept override;
    bool is_applicable(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                       const ColumnMetadata& meta) const noexcept override;
    size_t estimate_encoded_size(const uint8_t* raw, size_t byte_count,
                                 uint32_t row_count,
                                 const ColumnMetadata& meta) const noexcept override;

    void encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                const ColumnMetadata& meta, EncodedBlock& out) const override;
    void decode(const EncodedBlock& block, const ColumnMetadata& meta,
                std::vector<uint8_t>& out_buf) const override;
};

class DeltaDeltaEncoding final : public IEncodingAlgorithm {
public:
    EncodingId  id()   const noexcept override { return EncodingId::DELTA_DELTA; }
    const char* name() const noexcept override { return "DELTA_DELTA"; }

    bool supports(DataTypeId type) const noexcept override;
    bool is_applicable(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                       const ColumnMetadata& meta) const noexcept override;
    size_t estimate_encoded_size(const uint8_t* raw, size_t byte_count,
                                 uint32_t row_count,
                                 const ColumnMetadata& meta) const noexcept override;

    void encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                const ColumnMetadata& meta, EncodedBlock& out) const override;
    void decode(const EncodedBlock& block, const ColumnMetadata& meta,
                std::vector<uint8_t>& out_buf) const override;
};

}} // namespace adb::codec
