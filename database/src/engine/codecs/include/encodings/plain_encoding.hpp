#pragma once
// =============================================================================
// plain_encoding.hpp — PLAIN (no encoding) — supports all types
// =============================================================================
#include "../codec_interface.hpp"

namespace adb { namespace codec {

class PlainEncoding final : public IEncodingAlgorithm {
public:
    EncodingId  id()   const noexcept override { return EncodingId::PLAIN; }
    const char* name() const noexcept override { return "PLAIN"; }

    bool supports(DataTypeId) const noexcept override { return true; }

    bool is_applicable(const uint8_t*, size_t, uint32_t,
                       const ColumnMetadata&) const noexcept override {
        return true; // always applicable as fallback
    }

    size_t estimate_encoded_size(const uint8_t*, size_t byte_count,
                                 uint32_t, const ColumnMetadata&) const noexcept override {
        return byte_count;
    }

    void encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                const ColumnMetadata& meta, EncodedBlock& out) const override;

    void decode(const EncodedBlock& block, const ColumnMetadata& meta,
                std::vector<uint8_t>& out_buf) const override;
};

}} // namespace adb::codec
