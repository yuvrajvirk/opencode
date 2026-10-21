# Development experiment: cache pressure fast path

The weighted-cache candidate has 9,180 exact restores and saves 58.9% of large-file edit submission bytes, but Node medium append edit-save time regresses in all five pairs (median paired ratio 1.176; about 13.5 microseconds per save). Do not dismiss this as noise or select it solely for byte savings.

Try avoiding LRU delete/reinsert operations when the cache has room for another maximum-size chunk and another entry. Continue refreshing under pressure; preserve the same total character and entry caps. This is a general bookkeeping optimization, not a fixture-specific branch. Compare all development cases and diagnostic boundary probes, preserving any changed outcomes. Run the same cross-engine five-pair cost campaign if byte/correctness checks pass. Do not open the heldout set. Retain the original weighted implementation and all cost samples regardless of outcome.
