#pragma once
// =============================================================================
// codec_types.hpp
// Core types, enums, and data structures shared across the entire codec engine.
// No algorithm logic here — only contracts and PODs.
// =============================================================================

#include <cstdint>
#include <cstddef>
#include <string>
#include <vector>
#include <unordered_map>
#include <optional>
#include <variant>
#include <stdexcept>
#include <limits>
#include <cassert>
#include <memory>

namespace adb {
namespace codec {

// =============================================================================
// Data type identifiers
// =============================================================================
enum class DataTypeId : uint8_t {
    INT8        = 0,
    INT16       = 1,
    INT32       = 2,
    INT64       = 3,
    UINT8       = 4,
    UINT16      = 5,
    UINT32      = 6,
    UINT64      = 7,
    FLOAT32     = 8,
    FLOAT64     = 9,
    BOOLEAN     = 10,
    DATE32      = 11,   // days since 1970-01-01, stored as INT32
    TIMESTAMP64 = 12,   // microseconds since epoch UTC, stored as INT64
    DURATION64  = 13,   // microseconds, signed INT64
    DECIMAL128  = 14,   // 16 bytes, fixed precision+scale
    UTF8        = 15,   // variable-length UTF-8
    LARGE_UTF8  = 16,   // UTF-8 with INT64 offsets
    BINARY      = 17,   // raw bytes, INT32 offsets
    LARGE_BINARY= 18,   // raw bytes, INT64 offsets
    LIST        = 19,
    STRUCT      = 20,
    MAP         = 21,
    ENUM        = 22,   // dictionary-backed fixed domain
    JSON        = 23,   // stored as BINARY
    UUID        = 24,   // 16 bytes fixed
    INET        = 25,   // 16 bytes fixed (IPv4-mapped IPv6)
    INTERVAL    = 26,   // months(INT32) + days(INT32) + microseconds(INT64)
    UNKNOWN     = 255
};

// =============================================================================
// Encoding algorithm identifiers
// =============================================================================
enum class EncodingId : uint8_t {
    PLAIN              = 0,
    RLE                = 1,
    RLE_DICTIONARY     = 2,
    DICTIONARY         = 3,
    DELTA              = 4,
    DELTA_DELTA        = 5,
    FRAME_OF_REFERENCE = 6,
    BIT_PACKING        = 7,
    BYTE_STREAM_SPLIT  = 8,
    FSST               = 9,
    ALP                = 10,
    ROARING_BITMAP     = 11,
    PACKED_BOOLEAN     = 12,
    UNKNOWN            = 255
};

// =============================================================================
// Compression algorithm identifiers
// =============================================================================
enum class CompressionId : uint8_t {
    NONE      = 0,
    LZ4       = 1,
    LZ4_HC    = 2,
    ZSTD      = 3,   // level stored separately in CodecProfile
    SNAPPY    = 4,
    BROTLI    = 5,   // level stored separately
    GZIP      = 6,   // level stored separately
    LZMA      = 7,
    BZIP2     = 8,
    ZLIB      = 9,
    DEFLATE   = 10,
    UNKNOWN   = 255
};

// =============================================================================
// Compression speed classification
// =============================================================================
enum class SpeedClass : uint8_t {
    ULTRA_FAST = 0,
    FAST       = 1,
    BALANCED   = 2,
    SLOW       = 3,
    ULTRA_SLOW = 4
};

// =============================================================================
// Null encoding strategy
// =============================================================================
enum class NullEncoding : uint8_t {
    BITMAP   = 0,   // separate packed bit array — default
    SENTINEL = 1    // NaN sentinel for FLOAT32/FLOAT64 only
};

// =============================================================================
// Fixed-size physical byte widths per type
// Returns 0 for variable-length types.
// =============================================================================
inline constexpr size_t physical_byte_width(DataTypeId t) noexcept {
    switch (t) {
        case DataTypeId::INT8:        return 1;
        case DataTypeId::INT16:       return 2;
        case DataTypeId::INT32:       return 4;
        case DataTypeId::INT64:       return 8;
        case DataTypeId::UINT8:       return 1;
        case DataTypeId::UINT16:      return 2;
        case DataTypeId::UINT32:      return 4;
        case DataTypeId::UINT64:      return 8;
        case DataTypeId::FLOAT32:     return 4;
        case DataTypeId::FLOAT64:     return 8;
        case DataTypeId::BOOLEAN:     return 1;  // logical; packed to 1/8 byte
        case DataTypeId::DATE32:      return 4;
        case DataTypeId::TIMESTAMP64: return 8;
        case DataTypeId::DURATION64:  return 8;
        case DataTypeId::DECIMAL128:  return 16;
        case DataTypeId::UUID:        return 16;
        case DataTypeId::INET:        return 16;
        default:                      return 0;   // variable-length
    }
}

inline constexpr bool is_fixed_width(DataTypeId t) noexcept {
    return physical_byte_width(t) > 0;
}

inline constexpr bool is_integer_type(DataTypeId t) noexcept {
    switch (t) {
        case DataTypeId::INT8: case DataTypeId::INT16:
        case DataTypeId::INT32: case DataTypeId::INT64:
        case DataTypeId::UINT8: case DataTypeId::UINT16:
        case DataTypeId::UINT32: case DataTypeId::UINT64:
        case DataTypeId::DATE32: case DataTypeId::TIMESTAMP64:
        case DataTypeId::DURATION64:
            return true;
        default:
            return false;
    }
}

inline constexpr bool is_float_type(DataTypeId t) noexcept {
    return t == DataTypeId::FLOAT32 || t == DataTypeId::FLOAT64;
}

inline constexpr bool is_string_type(DataTypeId t) noexcept {
    return t == DataTypeId::UTF8 || t == DataTypeId::LARGE_UTF8
        || t == DataTypeId::ENUM || t == DataTypeId::JSON;
}

// =============================================================================
// Column metadata snapshot — resolved from the metadata store before I/O
// =============================================================================
struct ColumnMetadata {
    std::string  column_name;
    std::string  table_name;
    DataTypeId   data_type         = DataTypeId::UNKNOWN;
    std::string  codec_profile_id;
    bool         nullable          = true;
    int32_t      decimal_precision = 0;     // for DECIMAL128 only
    int32_t      decimal_scale     = 0;     // for DECIMAL128 only

    // Statistics (updated after every write flush)
    int64_t      row_count         = 0;
    int64_t      null_count        = 0;
    int64_t      distinct_count    = -1;    // -1 = unknown
    double       avg_value_size    = 0.0;   // bytes, for variable-length

    // Numeric stats stored as raw bytes (8 bytes max, little-endian)
    std::vector<uint8_t> min_value_bytes;
    std::vector<uint8_t> max_value_bytes;

    // ENUM domain (ordered)
    std::vector<std::string> enum_domain;

    // FSST/DICT training data (serialized, opaque to codec_types)
    std::vector<uint8_t> encoding_metadata_blob;

    // ZSTD column dictionary (if trained)
    std::vector<uint8_t> zstd_dict_blob;
};

// =============================================================================
// A single encoded+compressed data block
// =============================================================================
struct EncodedBlock {
    EncodingId   encoding_id      = EncodingId::UNKNOWN;
    CompressionId compression_id  = CompressionId::NONE;
    uint32_t     row_count        = 0;
    uint32_t     null_count       = 0;
    uint32_t     encoded_size     = 0;   // bytes after encoding, before compression
    uint32_t     compressed_size  = 0;   // bytes in `data` field (after compression)

    // Non-null value data (compressed). Null positions tracked in null_bitmap.
    std::vector<uint8_t> data;

    // One bit per original row; 1=non-null. Only present when null_count > 0.
    // Stored as packed bytes (ceil(row_count/8) bytes), MSB=row0.
    std::vector<uint8_t> null_bitmap;

    // Encoding-specific side data (e.g., dictionary, FSST symbol table, ALP factors).
    // Key: short string identifier, value: raw bytes.
    std::unordered_map<std::string, std::vector<uint8_t>> side_data;
};

// =============================================================================
// A codec profile — ties encoding + compression to a column
// =============================================================================
struct CodecProfile {
    std::string       profile_id;
    std::vector<DataTypeId> applicable_types;
    EncodingId        encoding          = EncodingId::PLAIN;
    CompressionId     compression       = CompressionId::ZSTD;
    int32_t           compression_level = 6;
    uint32_t          block_size_bytes  = 128 * 1024;  // 128 KB uncompressed target
    NullEncoding      null_encoding     = NullEncoding::BITMAP;
    std::string       description;
};

// =============================================================================
// Codec engine exceptions — all thrown as these types; never std::exception directly
// =============================================================================
class CodecError : public std::runtime_error {
public:
    explicit CodecError(const std::string& msg) : std::runtime_error(msg) {}
};

class EncodingError : public CodecError {
public:
    explicit EncodingError(const std::string& msg) : CodecError("EncodingError: " + msg) {}
};

class DecodingError : public CodecError {
public:
    explicit DecodingError(const std::string& msg) : CodecError("DecodingError: " + msg) {}
};

class CompressionError : public CodecError {
public:
    explicit CompressionError(const std::string& msg) : CodecError("CompressionError: " + msg) {}
};

class RegistryError : public CodecError {
public:
    explicit RegistryError(const std::string& msg) : CodecError("RegistryError: " + msg) {}
};

// =============================================================================
// Byte-level utilities
// =============================================================================
namespace util {

// Write a uint64_t as 8 little-endian bytes
inline void write_u64_le(uint8_t* dst, uint64_t v) noexcept {
    dst[0] = static_cast<uint8_t>(v);
    dst[1] = static_cast<uint8_t>(v >> 8);
    dst[2] = static_cast<uint8_t>(v >> 16);
    dst[3] = static_cast<uint8_t>(v >> 24);
    dst[4] = static_cast<uint8_t>(v >> 32);
    dst[5] = static_cast<uint8_t>(v >> 40);
    dst[6] = static_cast<uint8_t>(v >> 48);
    dst[7] = static_cast<uint8_t>(v >> 56);
}

inline void write_u32_le(uint8_t* dst, uint32_t v) noexcept {
    dst[0] = static_cast<uint8_t>(v);
    dst[1] = static_cast<uint8_t>(v >> 8);
    dst[2] = static_cast<uint8_t>(v >> 16);
    dst[3] = static_cast<uint8_t>(v >> 24);
}

inline void write_u16_le(uint8_t* dst, uint16_t v) noexcept {
    dst[0] = static_cast<uint8_t>(v);
    dst[1] = static_cast<uint8_t>(v >> 8);
}

inline uint64_t read_u64_le(const uint8_t* src) noexcept {
    return (static_cast<uint64_t>(src[0]))
         | (static_cast<uint64_t>(src[1]) << 8)
         | (static_cast<uint64_t>(src[2]) << 16)
         | (static_cast<uint64_t>(src[3]) << 24)
         | (static_cast<uint64_t>(src[4]) << 32)
         | (static_cast<uint64_t>(src[5]) << 40)
         | (static_cast<uint64_t>(src[6]) << 48)
         | (static_cast<uint64_t>(src[7]) << 56);
}

inline uint32_t read_u32_le(const uint8_t* src) noexcept {
    return (static_cast<uint32_t>(src[0]))
         | (static_cast<uint32_t>(src[1]) << 8)
         | (static_cast<uint32_t>(src[2]) << 16)
         | (static_cast<uint32_t>(src[3]) << 24);
}

inline uint16_t read_u16_le(const uint8_t* src) noexcept {
    return static_cast<uint16_t>(src[0]) | (static_cast<uint16_t>(src[1]) << 8);
}

// Minimum number of bits required to represent value v (v >= 0)
inline uint32_t min_bits_for(uint64_t v) noexcept {
    if (v == 0) return 1;
    uint32_t bits = 0;
    while (v > 0) { v >>= 1; ++bits; }
    return bits;
}

// popcount — number of set bits in a byte array
inline uint64_t popcount_bytes(const uint8_t* data, size_t len) noexcept {
    uint64_t count = 0;
    for (size_t i = 0; i < len; ++i) {
        uint8_t b = data[i];
        // Brian Kernighan or compiler builtin
#if defined(__GNUC__) || defined(__clang__)
        count += static_cast<uint64_t>(__builtin_popcount(b));
#else
        b -= (b >> 1) & 0x55u;
        b = (b & 0x33u) + ((b >> 2) & 0x33u);
        count += (b + (b >> 4)) & 0x0Fu;
#endif
    }
    return count;
}

// Variable-length integer encoding (unsigned, little-endian base-128)
// Returns number of bytes written. dst must have at least 10 bytes available.
inline size_t write_varint(uint8_t* dst, uint64_t value) noexcept {
    size_t n = 0;
    while (value > 0x7F) {
        dst[n++] = static_cast<uint8_t>((value & 0x7F) | 0x80);
        value >>= 7;
    }
    dst[n++] = static_cast<uint8_t>(value & 0x7F);
    return n;
}

// Returns 0 on failure (malformed or insufficient data).
// *bytes_read set to number of bytes consumed.
inline uint64_t read_varint(const uint8_t* src, size_t available, size_t* bytes_read) noexcept {
    uint64_t result = 0;
    uint32_t shift  = 0;
    size_t   i      = 0;
    while (i < available && i < 10) {
        uint8_t b = src[i++];
        result |= (static_cast<uint64_t>(b & 0x7F) << shift);
        if ((b & 0x80) == 0) { *bytes_read = i; return result; }
        shift += 7;
    }
    *bytes_read = 0;
    return 0;
}

} // namespace util
} // namespace codec
} // namespace adb
