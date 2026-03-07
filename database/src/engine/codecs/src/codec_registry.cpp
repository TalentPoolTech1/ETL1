// =============================================================================
// codec_registry.cpp
// =============================================================================

#include "../include/codec_registry.hpp"
#include <algorithm>
#include <stdexcept>
#include <climits>

namespace adb {
namespace codec {

CodecRegistry& CodecRegistry::instance() {
    static CodecRegistry reg;
    return reg;
}

// ── Registration ─────────────────────────────────────────────────────────────

void CodecRegistry::register_encoding(std::unique_ptr<IEncodingAlgorithm> enc) {
    if (!enc) throw RegistryError("register_encoding: null pointer");
    std::lock_guard<std::mutex> lk(mutex_);
    EncodingId eid = enc->id();
    if (encodings_.count(eid)) {
        throw RegistryError(std::string("Encoding '") + enc->name() + "' already registered");
    }
    encodings_.emplace(eid, std::move(enc));
}

void CodecRegistry::register_compression(std::unique_ptr<ICompressionAlgorithm> cmp) {
    if (!cmp) throw RegistryError("register_compression: null pointer");
    std::lock_guard<std::mutex> lk(mutex_);
    CompressionKey key{cmp->id(), cmp->level()};
    if (compressions_.count(key)) {
        throw RegistryError(std::string("Compression '") + cmp->name()
            + "' level=" + std::to_string(cmp->level()) + " already registered");
    }
    compressions_.emplace(key, std::move(cmp));
}

void CodecRegistry::register_profile(CodecProfile profile) {
    if (profile.profile_id.empty()) throw RegistryError("register_profile: empty profile_id");
    std::lock_guard<std::mutex> lk(mutex_);
    if (profiles_.count(profile.profile_id)) {
        throw RegistryError("CodecProfile '" + profile.profile_id + "' already registered");
    }
    profiles_.emplace(profile.profile_id, std::move(profile));
}

void CodecRegistry::set_default_profile(DataTypeId type, const std::string& profile_id) {
    std::lock_guard<std::mutex> lk(mutex_);
    if (!profiles_.count(profile_id)) {
        throw RegistryError("set_default_profile: profile '" + profile_id + "' not registered");
    }
    default_profiles_[type] = profile_id;
}

// ── Lookup ───────────────────────────────────────────────────────────────────

const IEncodingAlgorithm& CodecRegistry::get_encoding(EncodingId id) const {
    std::lock_guard<std::mutex> lk(mutex_);
    auto it = encodings_.find(id);
    if (it == encodings_.end()) {
        throw RegistryError("Encoding id=" + std::to_string(static_cast<int>(id)) + " not registered");
    }
    return *it->second;
}

const ICompressionAlgorithm& CodecRegistry::get_compression(CompressionId id, int32_t level) const {
    std::lock_guard<std::mutex> lk(mutex_);
    CompressionKey key{id, level};
    auto it = compressions_.find(key);
    if (it == compressions_.end()) {
        throw RegistryError("Compression id=" + std::to_string(static_cast<int>(id))
            + " level=" + std::to_string(level) + " not registered");
    }
    return *it->second;
}

const CodecProfile& CodecRegistry::get_profile(const std::string& profile_id) const {
    std::lock_guard<std::mutex> lk(mutex_);
    auto it = profiles_.find(profile_id);
    if (it == profiles_.end()) {
        throw RegistryError("CodecProfile '" + profile_id + "' not found");
    }
    return it->second;
}

const CodecProfile& CodecRegistry::get_default_profile(DataTypeId type) const {
    std::lock_guard<std::mutex> lk(mutex_);
    auto it = default_profiles_.find(type);
    if (it == default_profiles_.end()) {
        throw RegistryError("No default profile registered for DataTypeId="
            + std::to_string(static_cast<int>(type)));
    }
    auto pit = profiles_.find(it->second);
    if (pit == profiles_.end()) {
        throw RegistryError("Default profile '" + it->second + "' not found in profiles map");
    }
    return pit->second;
}

// ── Core pipeline ─────────────────────────────────────────────────────────────

void CodecRegistry::encode(
    const uint8_t*        raw_data,
    size_t                byte_count,
    uint32_t              row_count,
    const ColumnMetadata& meta,
    EncodedBlock&         out
) const {
    const CodecProfile& profile = get_profile(meta.codec_profile_id);
    const IEncodingAlgorithm& enc = get_encoding(profile.encoding);

    if (!enc.supports(meta.data_type)) {
        throw EncodingError("Encoding '" + std::string(enc.name())
            + "' does not support type " + std::to_string(static_cast<int>(meta.data_type)));
    }

    // Stage 1: encode
    enc.encode(raw_data, byte_count, row_count, meta, out);
    out.encoding_id = profile.encoding;

    // Stage 2: compress
    const ICompressionAlgorithm& cmp = resolve_compression(profile);
    size_t bound = cmp.compress_bound(out.data.size());
    std::vector<uint8_t> compressed(bound);
    size_t n = cmp.compress(
        out.data.data(), out.data.size(),
        compressed.data(), compressed.size(),
        meta.zstd_dict_blob
    );
    compressed.resize(n);
    out.encoded_size    = static_cast<uint32_t>(out.data.size());
    out.data            = std::move(compressed);
    out.compressed_size = static_cast<uint32_t>(out.data.size());
    out.compression_id  = profile.compression;
}

std::vector<uint8_t> CodecRegistry::decode(
    const EncodedBlock&   block,
    const ColumnMetadata& meta
) const {
    const CodecProfile& profile = get_profile(meta.codec_profile_id);

    // Stage 1: decompress
    const ICompressionAlgorithm& cmp = get_compression(
        block.compression_id, profile.compression_level);
    std::vector<uint8_t> encoded =
        cmp.decompress_vec(block.data, block.encoded_size, meta.zstd_dict_blob);

    // Stage 2: decode
    const IEncodingAlgorithm& enc = get_encoding(block.encoding_id);
    // Reconstruct a block with decompressed data for the decoder
    EncodedBlock tmp = block;
    tmp.data = std::move(encoded);

    std::vector<uint8_t> out;
    enc.decode(tmp, meta, out);
    return out;
}

// ── Auto-profile selection ────────────────────────────────────────────────────

const CodecProfile& CodecRegistry::select_best_profile(
    const uint8_t*        raw_data,
    size_t                byte_count,
    uint32_t              row_count,
    const ColumnMetadata& meta
) const {
    std::lock_guard<std::mutex> lk(mutex_);

    const std::string* best_id   = nullptr;
    size_t             best_size = SIZE_MAX;

    for (auto& [pid, profile] : profiles_) {
        // Check type compatibility
        bool type_ok = false;
        for (DataTypeId t : profile.applicable_types) {
            if (t == meta.data_type) { type_ok = true; break; }
        }
        if (!type_ok) continue;

        // Check encoding applicability
        auto enc_it = encodings_.find(profile.encoding);
        if (enc_it == encodings_.end()) continue;
        if (!enc_it->second->supports(meta.data_type)) continue;
        if (!enc_it->second->is_applicable(raw_data, byte_count, row_count, meta)) continue;

        size_t est = enc_it->second->estimate_encoded_size(
            raw_data, byte_count, row_count, meta);
        if (est == SIZE_MAX) continue;

        // Apply a rough compression factor per algorithm
        auto cmp_it = compressions_.find({profile.compression, profile.compression_level});
        float factor = 0.5f; // default assumption
        if (cmp_it != compressions_.end()) {
            switch (cmp_it->second->speed()) {
                case SpeedClass::ULTRA_FAST: factor = 0.65f; break;
                case SpeedClass::FAST:       factor = 0.55f; break;
                case SpeedClass::BALANCED:   factor = 0.45f; break;
                case SpeedClass::SLOW:       factor = 0.38f; break;
                case SpeedClass::ULTRA_SLOW: factor = 0.28f; break;
            }
        }
        size_t score = static_cast<size_t>(static_cast<float>(est) * factor);
        if (score < best_size) {
            best_size = score;
            best_id   = &pid;
        }
    }

    if (best_id) {
        return profiles_.at(*best_id);
    }

    // Fallback: default profile for the type
    auto dit = default_profiles_.find(meta.data_type);
    if (dit != default_profiles_.end()) {
        auto pit = profiles_.find(dit->second);
        if (pit != profiles_.end()) return pit->second;
    }
    throw RegistryError("select_best_profile: no applicable profile for DataTypeId="
        + std::to_string(static_cast<int>(meta.data_type)));
}

// ── Introspection ─────────────────────────────────────────────────────────────

std::vector<EncodingId> CodecRegistry::list_encodings() const {
    std::lock_guard<std::mutex> lk(mutex_);
    std::vector<EncodingId> out;
    out.reserve(encodings_.size());
    for (auto& [k, _] : encodings_) out.push_back(k);
    return out;
}

std::vector<CompressionId> CodecRegistry::list_compressions() const {
    std::lock_guard<std::mutex> lk(mutex_);
    std::vector<CompressionId> out;
    out.reserve(compressions_.size());
    for (auto& [k, _] : compressions_) out.push_back(k.id);
    return out;
}

std::vector<std::string> CodecRegistry::list_profiles() const {
    std::lock_guard<std::mutex> lk(mutex_);
    std::vector<std::string> out;
    out.reserve(profiles_.size());
    for (auto& [k, _] : profiles_) out.push_back(k);
    return out;
}

std::vector<std::string> CodecRegistry::profiles_for_type(DataTypeId type) const {
    std::lock_guard<std::mutex> lk(mutex_);
    std::vector<std::string> out;
    for (auto& [pid, p] : profiles_) {
        for (DataTypeId t : p.applicable_types) {
            if (t == type) { out.push_back(pid); break; }
        }
    }
    return out;
}

size_t CodecRegistry::encoding_count() const noexcept {
    std::lock_guard<std::mutex> lk(mutex_);
    return encodings_.size();
}

size_t CodecRegistry::compression_count() const noexcept {
    std::lock_guard<std::mutex> lk(mutex_);
    return compressions_.size();
}

size_t CodecRegistry::profile_count() const noexcept {
    std::lock_guard<std::mutex> lk(mutex_);
    return profiles_.size();
}

// ── Private helpers ───────────────────────────────────────────────────────────

const ICompressionAlgorithm& CodecRegistry::resolve_compression(
    const CodecProfile& p) const
{
    CompressionKey key{p.compression, p.compression_level};
    auto it = compressions_.find(key);
    if (it == compressions_.end()) {
        throw RegistryError("resolve_compression: compression id="
            + std::to_string(static_cast<int>(p.compression))
            + " level=" + std::to_string(p.compression_level)
            + " not registered (profile=" + p.profile_id + ")");
    }
    return *it->second;
}

} // namespace codec
} // namespace adb
