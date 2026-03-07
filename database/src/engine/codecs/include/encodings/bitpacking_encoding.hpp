#pragma once
// =============================================================================
// bitpacking_encoding.hpp
// Bit-packing for integer types after Frame-of-Reference.
// Also used standalone for small-range integer columns.
// Wire format:
//   [value_width_bits(1)] [packed_bits...]
// All values are packed MSB-first within each byte.
// Supports: INT8/16/32, UINT8/16/32
// =============================================================================
#include "../codec_interface.hpp"

namespace adb { namespace codec {

class BitPackingEncoding final : public IEncodingAlgorithm {
public:
    EncodingId  id()   const noexcept override { return EncodingId::BIT_PACKING; }
    const char* name() const noexcept override { return "BIT_PACKING"; }

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

    // Static helpers reused by FOR+BitPacking combo
    static uint32_t compute_bit_width(const uint8_t* raw, size_t vw, uint32_t row_count) noexcept;

    static void pack_bits(const uint32_t* values, uint32_t row_count,
                          uint32_t bit_width, std::vector<uint8_t>& out);

    static void unpack_bits(const uint8_t* packed, uint32_t row_count,
                            uint32_t bit_width, std::vector<uint32_t>& out);
};

// =============================================================================
// for_encoding.hpp — Frame of Reference + optional BitPacking
// Wire format:
//   [value_width(1)] [min_value(8 LE)] [bit_width(1)] [packed_offsets...]
// Supports: INT8/16/32/64, UINT8/16/32/64, FLOAT32, FLOAT64
// =============================================================================
class ForEncoding final : public IEncodingAlgorithm {
public:
    EncodingId  id()   const noexcept override { return EncodingId::FRAME_OF_REFERENCE; }
    const char* name() const noexcept override { return "FRAME_OF_REFERENCE"; }

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
