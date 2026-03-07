// =============================================================================
// delta_encoding.cpp — DELTA and DELTA_DELTA
// All arithmetic is done as uint64_t with wrapping to avoid UB on signed overflow.
// Reconstruction uses the same wrapping — correct for two's complement.
// =============================================================================
#include "../include/encodings/delta_encoding.hpp"
#include <cstring>

namespace adb { namespace codec {

// ── DELTA ────────────────────────────────────────────────────────────────────

bool DeltaEncoding::supports(DataTypeId type) const noexcept {
    switch (type) {
        case DataTypeId::INT8:  case DataTypeId::INT16:
        case DataTypeId::INT32: case DataTypeId::INT64:
        case DataTypeId::UINT8: case DataTypeId::UINT16:
        case DataTypeId::UINT32: case DataTypeId::UINT64:
        case DataTypeId::DATE32: case DataTypeId::TIMESTAMP64:
        case DataTypeId::DURATION64:
            return true;
        default: return false;
    }
}

bool DeltaEncoding::is_applicable(const uint8_t* raw, size_t byte_count,
                                   uint32_t row_count,
                                   const ColumnMetadata& meta) const noexcept {
    if (!raw || row_count < 2) return false;
    uint32_t vw = static_cast<uint32_t>(physical_byte_width(meta.data_type));
    if (vw == 0) return false;
    // Sample up to 256 rows. If max_delta < half the type range → beneficial.
    uint32_t sample = std::min(row_count, 256u);
    uint64_t max_delta = 0;
    for (uint32_t i = 1; i < sample; ++i) {
        uint64_t a = 0, b = 0;
        std::memcpy(&a, raw + (i-1)*vw, vw);
        std::memcpy(&b, raw + i*vw,     vw);
        uint64_t d = (b >= a) ? (b - a) : (a - b);
        if (d > max_delta) max_delta = d;
    }
    // Beneficial if deltas fit in fewer bytes than original values
    uint32_t delta_bits = util::min_bits_for(max_delta);
    uint32_t orig_bits  = vw * 8;
    return delta_bits < orig_bits;
}

size_t DeltaEncoding::estimate_encoded_size(const uint8_t* raw, size_t byte_count,
                                             uint32_t row_count,
                                             const ColumnMetadata& meta) const noexcept {
    return 1 + byte_count; // header + same storage (compression handles the rest)
}

void DeltaEncoding::encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                            const ColumnMetadata& meta, EncodedBlock& out) const
{
    uint32_t vw = static_cast<uint32_t>(physical_byte_width(meta.data_type));
    if (vw == 0) throw EncodingError("DELTA: variable-length type not supported");
    if (byte_count != static_cast<size_t>(row_count) * vw) {
        throw EncodingError("DELTA: byte_count mismatch");
    }

    // Output: [vw(1)] [first_value(vw)] [delta_1(vw)] ... [delta_n-1(vw)]
    std::vector<uint8_t> buf;
    buf.reserve(1 + byte_count);
    buf.push_back(static_cast<uint8_t>(vw));

    // Copy first value raw
    for (uint32_t b = 0; b < vw; ++b) buf.push_back(raw[b]);

    for (uint32_t i = 1; i < row_count; ++i) {
        uint64_t prev = 0, curr = 0;
        std::memcpy(&prev, raw + (i-1)*vw, vw);
        std::memcpy(&curr, raw + i*vw,     vw);
        uint64_t delta = curr - prev; // wrapping subtraction
        for (uint32_t b = 0; b < vw; ++b)
            buf.push_back(static_cast<uint8_t>((delta >> (b * 8)) & 0xFF));
    }

    out.encoding_id  = EncodingId::DELTA;
    out.row_count    = row_count;
    out.encoded_size = static_cast<uint32_t>(buf.size());
    out.data         = std::move(buf);
}

void DeltaEncoding::decode(const EncodedBlock& block, const ColumnMetadata& meta,
                            std::vector<uint8_t>& out_buf) const
{
    const uint8_t* src  = block.data.data();
    size_t         size = block.data.size();
    if (size < 1) throw DecodingError("DELTA: empty block");
    uint32_t vw = src[0];
    if (vw == 0 || vw > 8) throw DecodingError("DELTA: invalid vw=" + std::to_string(vw));

    size_t expected = 1 + static_cast<size_t>(block.row_count) * vw;
    if (size < expected) {
        throw DecodingError("DELTA: block too small: " + std::to_string(size)
            + " < " + std::to_string(expected));
    }

    out_buf.resize(static_cast<size_t>(block.row_count) * vw);
    if (block.row_count == 0) return;

    // First value
    std::memcpy(out_buf.data(), src + 1, vw);

    uint64_t prev = 0;
    std::memcpy(&prev, src + 1, vw);

    for (uint32_t i = 1; i < block.row_count; ++i) {
        uint64_t delta = 0;
        std::memcpy(&delta, src + 1 + i * vw, vw);
        uint64_t curr = prev + delta; // wrapping addition
        std::memcpy(out_buf.data() + i * vw, &curr, vw);
        prev = curr;
    }
}

// ── DELTA_DELTA ───────────────────────────────────────────────────────────────

bool DeltaDeltaEncoding::supports(DataTypeId type) const noexcept {
    return type == DataTypeId::INT64 || type == DataTypeId::UINT64
        || type == DataTypeId::TIMESTAMP64 || type == DataTypeId::DURATION64;
}

bool DeltaDeltaEncoding::is_applicable(const uint8_t* raw, size_t byte_count,
                                        uint32_t row_count,
                                        const ColumnMetadata& meta) const noexcept {
    if (!raw || row_count < 3) return false;
    if (!supports(meta.data_type)) return false;
    // Check if first-order deltas are uniform (near-zero second-order deltas)
    uint32_t sample = std::min(row_count, 256u);
    uint64_t max_dd = 0;
    uint64_t v0, v1, v2;
    std::memcpy(&v0, raw, 8);
    std::memcpy(&v1, raw + 8, 8);
    uint64_t prev_delta = v1 - v0;
    for (uint32_t i = 2; i < sample; ++i) {
        std::memcpy(&v2, raw + i*8, 8);
        uint64_t d  = v2 - v1;
        uint64_t dd = (d >= prev_delta) ? (d - prev_delta) : (prev_delta - d);
        if (dd > max_dd) max_dd = dd;
        prev_delta = d;
        v1 = v2;
    }
    // Beneficial if second-order deltas are much smaller than first-order
    uint32_t dd_bits = util::min_bits_for(max_dd);
    return dd_bits < 32;
}

size_t DeltaDeltaEncoding::estimate_encoded_size(const uint8_t* raw, size_t byte_count,
                                                  uint32_t row_count,
                                                  const ColumnMetadata& meta) const noexcept {
    return 1 + byte_count;
}

void DeltaDeltaEncoding::encode(const uint8_t* raw, size_t byte_count, uint32_t row_count,
                                 const ColumnMetadata& meta, EncodedBlock& out) const
{
    if (!supports(meta.data_type)) throw EncodingError("DELTA_DELTA: unsupported type");
    if (byte_count != static_cast<size_t>(row_count) * 8) {
        throw EncodingError("DELTA_DELTA: byte_count mismatch");
    }

    // Format: [0x08(1)] [v0(8)] [delta_0(8)] [dd_1(8)] ... [dd_n-2(8)]
    std::vector<uint8_t> buf;
    buf.reserve(1 + byte_count);
    buf.push_back(0x08); // value width = 8

    if (row_count == 0) {
        out.encoding_id = EncodingId::DELTA_DELTA;
        out.row_count   = 0;
        out.encoded_size = static_cast<uint32_t>(buf.size());
        out.data = std::move(buf);
        return;
    }

    uint64_t v0;
    std::memcpy(&v0, raw, 8);
    uint8_t tmp[8];
    util::write_u64_le(tmp, v0);
    for (int b = 0; b < 8; ++b) buf.push_back(tmp[b]);

    if (row_count == 1) {
        out.encoding_id  = EncodingId::DELTA_DELTA;
        out.row_count    = 1;
        out.encoded_size = static_cast<uint32_t>(buf.size());
        out.data         = std::move(buf);
        return;
    }

    uint64_t v1;
    std::memcpy(&v1, raw + 8, 8);
    uint64_t first_delta = v1 - v0;
    util::write_u64_le(tmp, first_delta);
    for (int b = 0; b < 8; ++b) buf.push_back(tmp[b]);

    uint64_t prev = v0, prev_delta = first_delta;
    uint64_t cur_val = v1;

    for (uint32_t i = 2; i < row_count; ++i) {
        uint64_t vi;
        std::memcpy(&vi, raw + i*8, 8);
        uint64_t delta    = vi - cur_val;
        uint64_t dd       = delta - prev_delta;
        util::write_u64_le(tmp, dd);
        for (int b = 0; b < 8; ++b) buf.push_back(tmp[b]);
        prev_delta = delta;
        cur_val    = vi;
    }

    out.encoding_id  = EncodingId::DELTA_DELTA;
    out.row_count    = row_count;
    out.encoded_size = static_cast<uint32_t>(buf.size());
    out.data         = std::move(buf);
}

void DeltaDeltaEncoding::decode(const EncodedBlock& block, const ColumnMetadata& meta,
                                 std::vector<uint8_t>& out_buf) const
{
    const uint8_t* src = block.data.data();
    size_t         size = block.data.size();
    if (size < 1) throw DecodingError("DELTA_DELTA: empty block");
    if (src[0] != 0x08) throw DecodingError("DELTA_DELTA: expected vw=8");

    out_buf.resize(static_cast<size_t>(block.row_count) * 8);
    if (block.row_count == 0) return;

    size_t expected_size = 1 + static_cast<size_t>(block.row_count) * 8;
    if (size < expected_size) {
        throw DecodingError("DELTA_DELTA: block too small");
    }

    uint64_t v0 = util::read_u64_le(src + 1);
    util::write_u64_le(out_buf.data(), v0);
    if (block.row_count == 1) return;

    uint64_t d0 = util::read_u64_le(src + 9);
    uint64_t v1 = v0 + d0;
    util::write_u64_le(out_buf.data() + 8, v1);

    uint64_t prev_val   = v1;
    uint64_t prev_delta = d0;

    for (uint32_t i = 2; i < block.row_count; ++i) {
        uint64_t dd    = util::read_u64_le(src + 1 + i * 8);
        uint64_t delta = prev_delta + dd;
        uint64_t vi    = prev_val + delta;
        util::write_u64_le(out_buf.data() + i * 8, vi);
        prev_val   = vi;
        prev_delta = delta;
    }
}

}} // namespace adb::codec
