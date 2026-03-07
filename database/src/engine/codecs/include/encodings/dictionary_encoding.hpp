#pragma once
// =============================================================================
// dictionary_encoding.hpp
// DICTIONARY and RLE_DICTIONARY for string and low-cardinality columns.
// DICTIONARY wire format:
//   [dict_entry_count: 4 LE] [dict_bytes: serialized strings with 4-byte lengths]
//   [index_width: 1]         (1=UINT8, 2=UINT16, 4=UINT32)
//   [index_array: row_count × index_width LE]
//
// RLE_DICTIONARY adds RLE on top of the index_array:
//   [dict section: same as DICTIONARY]
//   [index_width: 1]
//   [rle_encoded_indices: (index_value varint)(run_len varint) pairs]
//
// Supports: UTF8, LARGE_UTF8, ENUM, BINARY, INT32, INT64, INET
// =============================================================================
#include "../codec_interface.hpp"
#include <unordered_map>

namespace adb { namespace codec {

class DictionaryEncoding final : public IEncodingAlgorithm {
public:
    EncodingId  id()   const noexcept override { return EncodingId::DICTIONARY; }
    const char* name() const noexcept override { return "DICTIONARY"; }

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

protected:
    // Parse the variable-length string buffer.
    // Format: row_count entries of [len(4 LE)][bytes(len)]
    static std::vector<std::vector<uint8_t>> parse_varbytes(
        const uint8_t* raw, size_t byte_count, uint32_t row_count);

    // Serialize a dict to bytes: [entry_count(4)] [len(4)][bytes]...
    static std::vector<uint8_t> serialize_dict(
        const std::vector<std::vector<uint8_t>>& dict);

    // Deserialize dict from bytes starting at offset. Returns new offset.
    static size_t deserialize_dict(const uint8_t* src, size_t size,
                                   size_t offset,
                                   std::vector<std::vector<uint8_t>>& dict);

    // Choose index width (1/2/4) based on dict size
    static uint8_t index_width_for(uint32_t dict_size) noexcept;
};

class RleDictionaryEncoding final : public IEncodingAlgorithm {
public:
    EncodingId  id()   const noexcept override { return EncodingId::RLE_DICTIONARY; }
    const char* name() const noexcept override { return "RLE_DICTIONARY"; }

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
