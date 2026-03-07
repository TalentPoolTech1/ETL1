#pragma once
// =============================================================================
// fsst_encoding.hpp
// FSST — Fast Static Symbol Table string compression.
// Reference: "FSST: Fast Random Access String Compression" (VLDB 2020).
//
// Algorithm:
//   1. Train a symbol table of up to 255 byte sequences (1–8 bytes each)
//      from a sample of the string column.
//   2. Encode each string by replacing the longest matching symbol prefix
//      with a 1-byte symbol code (0x00–0xFE). Bytes matching no symbol
//      are preceded by escape byte 0xFF and stored literally.
//   3. The symbol table is stored once in block.side_data["fsst_symtable"].
//
// Wire format (block.data):
//   Concatenated encoded strings.
//   Each string is preceded by [enc_len(4 LE)] — encoded byte count.
//   Original lengths are reconstructed during decode.
//   (We store original lengths in side_data["fsst_orig_lens"])
//
// Supports: UTF8, LARGE_UTF8, JSON, BINARY (structured binary only)
// =============================================================================
#include "../codec_interface.hpp"

namespace adb { namespace codec {

// Symbol table: up to 255 entries (index 0–254), each 1–8 bytes.
struct FsstSymbolTable {
    uint8_t  count = 0;
    uint8_t  lengths[255] = {};    // byte length of each symbol (1–8)
    uint8_t  data[255 * 8] = {};   // symbol bytes, each padded to 8 bytes

    // Serialize/deserialize for storage in side_data
    std::vector<uint8_t> serialize() const;
    static FsstSymbolTable deserialize(const uint8_t* src, size_t size);
};

class FsstEncoding final : public IEncodingAlgorithm {
public:
    EncodingId  id()   const noexcept override { return EncodingId::FSST; }
    const char* name() const noexcept override { return "FSST"; }

    bool supports(DataTypeId type) const noexcept override {
        switch (type) {
            case DataTypeId::UTF8: case DataTypeId::LARGE_UTF8:
            case DataTypeId::JSON: case DataTypeId::BINARY:
                return true;
            default: return false;
        }
    }

    bool is_applicable(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                       const ColumnMetadata& meta) const noexcept override {
        return row_count >= 4 && byte_count > 64;
    }

    size_t estimate_encoded_size(const uint8_t* raw, size_t byte_count,
                                 uint32_t row_count,
                                 const ColumnMetadata& meta) const noexcept override {
        // Conservative: assume 60% compression
        return static_cast<size_t>(static_cast<double>(byte_count) * 0.4)
             + row_count * 4 + 255 * 9; // symbol table overhead
    }

    void encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                const ColumnMetadata& meta, EncodedBlock& out) const override;

    void decode(const EncodedBlock& block, const ColumnMetadata& meta,
                std::vector<uint8_t>& out_buf) const override;

private:
    // Train symbol table from sample strings
    static FsstSymbolTable train(const std::vector<std::pair<const uint8_t*, uint32_t>>& samples);

    // Encode a single string using the symbol table
    static std::vector<uint8_t> encode_string(
        const uint8_t* str, uint32_t len, const FsstSymbolTable& st);

    // Decode a single FSST-encoded string
    static std::vector<uint8_t> decode_string(
        const uint8_t* enc, uint32_t enc_len, const FsstSymbolTable& st);
};

}} // namespace adb::codec
