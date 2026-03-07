#pragma once
// =============================================================================
// codec_interface.hpp
// Pure abstract interfaces for all encoding and compression algorithms.
// Every concrete algorithm inherits from these. No algorithm writes
// directly to disk or calls another algorithm — pure transformation only.
// =============================================================================

#include "codec_types.hpp"
#include <vector>
#include <cstdint>

namespace adb {
namespace codec {

// =============================================================================
// IEncodingAlgorithm
// Transforms a typed raw byte buffer → EncodedBlock (no compression applied).
// The `data` field of the returned block contains encoded-but-uncompressed bytes.
// The `compressed_size` field is 0 until compression runs.
// Implementations MUST be stateless — all state must come from ColumnMetadata.
// =============================================================================
class IEncodingAlgorithm {
public:
    virtual ~IEncodingAlgorithm() = default;

    // Identity of this algorithm
    virtual EncodingId  id()   const noexcept = 0;
    virtual const char* name() const noexcept = 0;

    // Which data types this encoding can handle
    virtual bool supports(DataTypeId type) const noexcept = 0;

    // Returns true if this encoding is likely beneficial for the given buffer.
    // Called by the auto-profile selector. Must be fast (O(n) maximum).
    // `raw_data` is the non-null value stream in physical layout (little-endian).
    virtual bool is_applicable(
        const uint8_t*   raw_data,
        size_t           byte_count,
        uint32_t         row_count,
        const ColumnMetadata& meta
    ) const noexcept = 0;

    // Approximate encoded size in bytes. Used for profile selection.
    // Must not allocate or throw. Returns SIZE_MAX on overflow / not applicable.
    virtual size_t estimate_encoded_size(
        const uint8_t*   raw_data,
        size_t           byte_count,
        uint32_t         row_count,
        const ColumnMetadata& meta
    ) const noexcept = 0;

    // Encode `row_count` non-null values from `raw_data` (physical layout).
    // Fills `block.data`, `block.encoded_size`, `block.encoding_id`,
    // and `block.side_data`. Does NOT touch `block.null_bitmap` or
    // `block.null_count` — the caller (ColumnWriter) handles nulls.
    // Throws EncodingError on any failure.
    virtual void encode(
        const uint8_t*   raw_data,
        size_t           byte_count,
        uint32_t         row_count,
        const ColumnMetadata& meta,
        EncodedBlock&    out
    ) const = 0;

    // Decode `block.data` back to physical layout into `out_buf`.
    // `out_buf` is pre-allocated to hold exactly `block.row_count` values
    // (i.e. byte_count = row_count × physical_byte_width, or known for var-len).
    // Throws DecodingError on any failure.
    virtual void decode(
        const EncodedBlock& block,
        const ColumnMetadata& meta,
        std::vector<uint8_t>& out_buf
    ) const = 0;
};

// =============================================================================
// ICompressionAlgorithm
// Pure byte-level block compression. Operates on the encoded bytes produced
// by IEncodingAlgorithm. Has no knowledge of data types or schemas.
// Implementations MUST be stateless (all state is in the level / config).
// =============================================================================
class ICompressionAlgorithm {
public:
    virtual ~ICompressionAlgorithm() = default;

    virtual CompressionId id()    const noexcept = 0;
    virtual const char*   name()  const noexcept = 0;
    virtual int32_t       level() const noexcept = 0;    // 0 for non-levelled
    virtual SpeedClass    speed() const noexcept = 0;

    // Upper bound on compressed size for an input of `src_size` bytes.
    // Used to pre-allocate the output buffer.
    virtual size_t compress_bound(size_t src_size) const noexcept = 0;

    // Compress src into dst. dst must be at least compress_bound(src_size) bytes.
    // Returns number of bytes written to dst.
    // Throws CompressionError on failure.
    virtual size_t compress(
        const uint8_t* src,
        size_t         src_size,
        uint8_t*       dst,
        size_t         dst_capacity,
        const std::vector<uint8_t>& zstd_dict   // empty if no dict
    ) const = 0;

    // Decompress src into dst. `original_size` is the uncompressed byte count
    // (stored in the block header). dst must be at least `original_size` bytes.
    // Returns number of bytes written to dst.
    // Throws CompressionError on failure.
    virtual size_t decompress(
        const uint8_t* src,
        size_t         src_size,
        uint8_t*       dst,
        size_t         original_size,
        const std::vector<uint8_t>& zstd_dict   // empty if no dict
    ) const = 0;

    // Convenience wrappers operating on vectors
    std::vector<uint8_t> compress_vec(
        const std::vector<uint8_t>& src,
        const std::vector<uint8_t>& zstd_dict = {}
    ) const {
        std::vector<uint8_t> dst(compress_bound(src.size()));
        size_t n = compress(src.data(), src.size(),
                            dst.data(), dst.size(), zstd_dict);
        dst.resize(n);
        return dst;
    }

    std::vector<uint8_t> decompress_vec(
        const std::vector<uint8_t>& src,
        size_t original_size,
        const std::vector<uint8_t>& zstd_dict = {}
    ) const {
        std::vector<uint8_t> dst(original_size);
        size_t n = decompress(src.data(), src.size(),
                              dst.data(), original_size, zstd_dict);
        if (n != original_size) {
            throw DecodingError("decompress_vec: got " + std::to_string(n)
                + " bytes, expected " + std::to_string(original_size));
        }
        return dst;
    }
};

} // namespace codec
} // namespace adb
