#pragma once
// =============================================================================
// alp_encoding.hpp
// ALP — Adaptive Lossless floating Point encoding for FLOAT64.
// Reference: "ALP: Adaptive Lossless floating-Point Compression" (SIGMOD 2024).
//
// Core idea: Most real-world FLOAT64 values have limited decimal precision
// (prices, rates, measurements). ALP multiplies by a chosen factor to convert
// them to near-integer INT64 values, then encodes with DELTA+BITPACKING.
// Exceptions (values that don't fit the pattern) are stored separately.
//
// Wire format:
//   [0x08(1)]              value_width marker
//   [exp_factor(1)]        exponent: multiply raw value by 10^exp_factor
//   [bit_width(1)]         bits per encoded integer
//   [exceptions_count(4)]  number of exception rows
//   [packed_integers...]   bit-packed encoded values (exceptions stored as 0)
//   [exception_indices...] exceptions_count × 4 bytes (row index, LE)
//   [exception_values...]  exceptions_count × 8 bytes (raw float64 LE)
//
// Supports: FLOAT64 only.
// =============================================================================
#include "../codec_interface.hpp"

namespace adb { namespace codec {

class AlpEncoding final : public IEncodingAlgorithm {
public:
    EncodingId  id()   const noexcept override { return EncodingId::ALP; }
    const char* name() const noexcept override { return "ALP"; }

    bool supports(DataTypeId type) const noexcept override {
        return type == DataTypeId::FLOAT64;
    }

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
    // Determine best exponent factor (0-18) by minimising exception count.
    static uint8_t find_best_exponent(const double* vals, uint32_t row_count,
                                       uint32_t sample_size) noexcept;

    // Encode a double with the given exponent to int64. Returns false if exception.
    static bool encode_value(double v, uint8_t exp, int64_t& out) noexcept;

    static constexpr double kFactors[19] = {
        1e0,  1e1,  1e2,  1e3,  1e4,  1e5,  1e6,  1e7,  1e8,  1e9,
        1e10, 1e11, 1e12, 1e13, 1e14, 1e15, 1e16, 1e17, 1e18
    };
};

}} // namespace adb::codec
