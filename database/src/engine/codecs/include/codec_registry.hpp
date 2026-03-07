#pragma once
// =============================================================================
// codec_registry.hpp
// Singleton registry. The ONLY place that owns all encoding and compression
// algorithm instances. Every other module calls the registry — no module
// directly constructs or holds algorithm objects.
// =============================================================================

#include "codec_types.hpp"
#include "codec_interface.hpp"
#include <unordered_map>
#include <string>
#include <memory>
#include <vector>
#include <mutex>

namespace adb {
namespace codec {

class CodecRegistry {
public:
    // ── Singleton access ─────────────────────────────────────────────────────
    static CodecRegistry& instance();

    // Non-copyable, non-movable
    CodecRegistry(const CodecRegistry&) = delete;
    CodecRegistry& operator=(const CodecRegistry&) = delete;

    // ── Registration ─────────────────────────────────────────────────────────

    // Register an encoding algorithm. Throws RegistryError if id already registered.
    void register_encoding(std::unique_ptr<IEncodingAlgorithm> enc);

    // Register a compression algorithm. Throws RegistryError if id already registered.
    // Multiple ZSTD levels are registered as separate instances (same id, different
    // level — the registry stores by (id, level) pair for compressions).
    void register_compression(std::unique_ptr<ICompressionAlgorithm> cmp);

    // Register a codec profile. Throws RegistryError if profile_id already registered.
    void register_profile(CodecProfile profile);

    // Set the default profile for a data type.
    // Throws RegistryError if profile_id is not registered.
    void set_default_profile(DataTypeId type, const std::string& profile_id);

    // ── Lookup ───────────────────────────────────────────────────────────────

    // Returns reference to registered encoding. Throws RegistryError if not found.
    const IEncodingAlgorithm& get_encoding(EncodingId id) const;

    // Returns reference to registered compression at the given level.
    // level is ignored for algorithms that are not level-based (NONE, LZ4, SNAPPY, etc.)
    // For level-based algorithms (ZSTD, BROTLI, GZIP), level must match a registered instance.
    const ICompressionAlgorithm& get_compression(CompressionId id, int32_t level = 0) const;

    // Returns a registered profile by id. Throws RegistryError if not found.
    const CodecProfile& get_profile(const std::string& profile_id) const;

    // Returns the default profile for a data type. Throws RegistryError if none set.
    const CodecProfile& get_default_profile(DataTypeId type) const;

    // ── Core pipeline operations (used exclusively by ColumnWriter/ColumnReader) ─

    // Full encode pipeline: raw bytes → encode → compress → fills EncodedBlock.
    // The null_bitmap and null_count in `out` must already be set by the caller.
    void encode(
        const uint8_t*        raw_data,
        size_t                byte_count,
        uint32_t              row_count,
        const ColumnMetadata& meta,
        EncodedBlock&         out
    ) const;

    // Full decode pipeline: EncodedBlock → decompress → decode → raw bytes.
    // Returns the non-null value stream in physical layout.
    // Null re-insertion is done by ColumnReader after this call.
    std::vector<uint8_t> decode(
        const EncodedBlock&   block,
        const ColumnMetadata& meta
    ) const;

    // ── Auto-profile selection ────────────────────────────────────────────────

    // Samples the raw data and returns the best registered CodecProfile for the
    // column based on estimated compressed size. Falls back to the registered
    // default profile if no better candidate is found.
    const CodecProfile& select_best_profile(
        const uint8_t*        raw_data,
        size_t                byte_count,
        uint32_t              row_count,
        const ColumnMetadata& meta
    ) const;

    // ── Introspection ─────────────────────────────────────────────────────────

    std::vector<EncodingId>    list_encodings()    const;
    std::vector<CompressionId> list_compressions() const;
    std::vector<std::string>   list_profiles()     const;
    std::vector<std::string>   profiles_for_type(DataTypeId type) const;

    // Total number of registered entries
    size_t encoding_count()    const noexcept;
    size_t compression_count() const noexcept;
    size_t profile_count()     const noexcept;

private:
    CodecRegistry() = default;

    // Compression key: (CompressionId, level). Level 0 for non-levelled.
    struct CompressionKey {
        CompressionId id;
        int32_t       level;
        bool operator==(const CompressionKey& o) const noexcept {
            return id == o.id && level == o.level;
        }
    };

    struct CompressionKeyHash {
        size_t operator()(const CompressionKey& k) const noexcept {
            return std::hash<uint32_t>()(
                (static_cast<uint32_t>(k.id) << 16) |
                static_cast<uint32_t>(static_cast<uint16_t>(k.level))
            );
        }
    };

    mutable std::mutex mutex_;

    std::unordered_map<EncodingId,
        std::unique_ptr<IEncodingAlgorithm>>           encodings_;

    std::unordered_map<CompressionKey,
        std::unique_ptr<ICompressionAlgorithm>,
        CompressionKeyHash>                            compressions_;

    std::unordered_map<std::string, CodecProfile>      profiles_;
    std::unordered_map<DataTypeId, std::string>        default_profiles_;

    // Helper: resolve compression from profile
    const ICompressionAlgorithm& resolve_compression(const CodecProfile& p) const;
};

} // namespace codec
} // namespace adb
