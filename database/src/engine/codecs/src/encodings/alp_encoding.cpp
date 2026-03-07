// =============================================================================
// alp_encoding.cpp
// =============================================================================
#include "../include/encodings/alp_encoding.hpp"
#include "../include/encodings/bitpacking_encoding.hpp"
#include <cstring>
#include <cmath>
#include <algorithm>
#include <climits>

namespace adb { namespace codec {

constexpr double AlpEncoding::kFactors[19];

bool AlpEncoding::encode_value(double v, uint8_t exp, int64_t& out) noexcept {
    if (std::isnan(v) || std::isinf(v)) return false;
    double scaled = v * kFactors[exp];
    // Check if it rounds to an integer within INT64 range
    double rounded = std::round(scaled);
    if (rounded > static_cast<double>(INT64_MAX) ||
        rounded < static_cast<double>(INT64_MIN)) return false;
    int64_t as_int = static_cast<int64_t>(rounded);
    // Verify round-trip is lossless
    double reconstructed = static_cast<double>(as_int) / kFactors[exp];
    if (reconstructed != v) return false;
    out = as_int;
    return true;
}

uint8_t AlpEncoding::find_best_exponent(const double* vals, uint32_t row_count,
                                          uint32_t sample_size) noexcept {
    uint32_t n = std::min(row_count, sample_size);
    uint8_t best_exp  = 0;
    uint32_t min_exc  = n + 1;

    for (uint8_t exp = 0; exp < 19; ++exp) {
        uint32_t exc_count = 0;
        for (uint32_t i = 0; i < n; ++i) {
            int64_t tmp;
            if (!encode_value(vals[i], exp, tmp)) ++exc_count;
        }
        if (exc_count < min_exc) {
            min_exc  = exc_count;
            best_exp = exp;
        }
        if (exc_count == 0) break; // perfect
    }
    return best_exp;
}

bool AlpEncoding::is_applicable(const uint8_t* raw, size_t byte_count,
                                  uint32_t row_count,
                                  const ColumnMetadata& meta) const noexcept {
    if (!raw || row_count < 8) return false;
    const double* vals = reinterpret_cast<const double*>(raw);
    uint8_t exp = find_best_exponent(vals, row_count, 256);
    // Applicable if > 80% of sampled values encode without exceptions
    uint32_t sample = std::min(row_count, 256u);
    uint32_t exc_count = 0;
    for (uint32_t i = 0; i < sample; ++i) {
        int64_t tmp;
        if (!encode_value(vals[i], exp, tmp)) ++exc_count;
    }
    return static_cast<double>(exc_count) / static_cast<double>(sample) < 0.2;
}

size_t AlpEncoding::estimate_encoded_size(const uint8_t* raw, size_t byte_count,
                                           uint32_t row_count,
                                           const ColumnMetadata& meta) const noexcept {
    // Assume 4 bits/value average after bit-packing + ~5% exceptions
    size_t packed = (static_cast<size_t>(row_count) * 4 + 7) / 8;
    size_t exc    = static_cast<size_t>(row_count) / 20;
    return 7 + packed + exc * 12; // header + packed + exceptions
}

void AlpEncoding::encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                          const ColumnMetadata& meta, EncodedBlock& out) const
{
    if (byte_count != static_cast<size_t>(row_count) * 8) {
        throw EncodingError("ALP: byte_count mismatch");
    }
    const double* vals = reinterpret_cast<const double*>(raw);

    uint8_t exp = find_best_exponent(vals, row_count, 512);

    // Encode all values; collect exceptions
    std::vector<int64_t> encoded(row_count, 0);
    std::vector<uint32_t> exc_indices;
    std::vector<double>   exc_values;

    int64_t mn = INT64_MAX, mx = INT64_MIN;
    for (uint32_t i = 0; i < row_count; ++i) {
        int64_t v;
        if (encode_value(vals[i], exp, v)) {
            encoded[i] = v;
            if (v < mn) mn = v;
            if (v > mx) mx = v;
        } else {
            exc_indices.push_back(i);
            exc_values.push_back(vals[i]);
            encoded[i] = 0; // placeholder
        }
    }

    if (row_count == 0 || mn == INT64_MAX) { mn = 0; mx = 0; }

    // Shift to unsigned for bit packing (subtract min)
    uint64_t range = static_cast<uint64_t>(mx - mn);
    uint32_t bw    = util::min_bits_for(range);
    if (bw == 0) bw = 1;

    std::vector<uint32_t> offsets(row_count);
    for (uint32_t i = 0; i < row_count; ++i) {
        uint64_t off = static_cast<uint64_t>(encoded[i] - mn);
        if (off > UINT32_MAX) throw EncodingError("ALP: offset overflow");
        offsets[i] = static_cast<uint32_t>(off);
    }

    // Wire format: [0x08][exp][bw][min(8)][exc_count(4)] [packed...] [exc_idx(4)...][exc_val(8)...]
    std::vector<uint8_t> buf;
    buf.reserve(16 + (static_cast<size_t>(row_count) * bw + 7) / 8
                   + exc_indices.size() * 12);
    buf.push_back(0x08);
    buf.push_back(exp);
    buf.push_back(static_cast<uint8_t>(bw));
    // min value (8 bytes LE)
    uint8_t tmp[8];
    std::memcpy(tmp, &mn, 8);
    for (int b = 0; b < 8; ++b) buf.push_back(tmp[b]);
    // exception count (4 bytes LE)
    uint32_t exc_count = static_cast<uint32_t>(exc_indices.size());
    uint8_t tmp4[4];
    util::write_u32_le(tmp4, exc_count);
    for (int b = 0; b < 4; ++b) buf.push_back(tmp4[b]);

    // Packed offsets
    BitPackingEncoding::pack_bits(offsets.data(), row_count, bw, buf);

    // Exception indices
    for (uint32_t idx : exc_indices) {
        util::write_u32_le(tmp4, idx);
        for (int b = 0; b < 4; ++b) buf.push_back(tmp4[b]);
    }
    // Exception values
    for (double v : exc_values) {
        std::memcpy(tmp, &v, 8);
        for (int b = 0; b < 8; ++b) buf.push_back(tmp[b]);
    }

    out.encoding_id  = EncodingId::ALP;
    out.row_count    = row_count;
    out.encoded_size = static_cast<uint32_t>(buf.size());
    out.data         = std::move(buf);
}

void AlpEncoding::decode(const EncodedBlock& block, const ColumnMetadata& meta,
                          std::vector<uint8_t>& out_buf) const
{
    const uint8_t* src  = block.data.data();
    size_t         size = block.data.size();

    if (size < 15) throw DecodingError("ALP: block too small");
    if (src[0] != 0x08) throw DecodingError("ALP: expected marker 0x08");
    uint8_t exp = src[1];
    uint8_t bw  = src[2];
    if (exp >= 19)  throw DecodingError("ALP: invalid exponent");
    if (bw == 0 || bw > 32) throw DecodingError("ALP: invalid bit_width");

    int64_t mn;
    std::memcpy(&mn, src + 3, 8);
    uint32_t exc_count = util::read_u32_le(src + 11);
    size_t pos = 15;

    // Unpack integers
    size_t packed_bytes = (static_cast<size_t>(block.row_count) * bw + 7) / 8;
    if (pos + packed_bytes > size) throw DecodingError("ALP: truncated packed data");
    std::vector<uint32_t> offsets;
    BitPackingEncoding::unpack_bits(src + pos, block.row_count, bw, offsets);
    pos += packed_bytes;

    out_buf.resize(static_cast<size_t>(block.row_count) * 8);
    double* out = reinterpret_cast<double*>(out_buf.data());
    for (uint32_t i = 0; i < block.row_count; ++i) {
        int64_t v = mn + static_cast<int64_t>(offsets[i]);
        out[i] = static_cast<double>(v) / kFactors[exp];
    }

    // Apply exceptions
    size_t exc_idx_start = pos;
    size_t exc_val_start = pos + static_cast<size_t>(exc_count) * 4;
    if (exc_val_start + static_cast<size_t>(exc_count) * 8 > size) {
        throw DecodingError("ALP: truncated exceptions");
    }
    for (uint32_t e = 0; e < exc_count; ++e) {
        uint32_t row_idx = util::read_u32_le(src + exc_idx_start + e * 4);
        if (row_idx >= block.row_count) throw DecodingError("ALP: exception index out of range");
        double v;
        std::memcpy(&v, src + exc_val_start + e * 8, 8);
        out[row_idx] = v;
    }
}

}} // namespace adb::codec
