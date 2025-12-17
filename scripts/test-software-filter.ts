
const deviceSoftware = [
  { software_name: "Google Chrome", version: "120.0.1", source_file: "test" },
  { software_name: "Firefox", version: "110.0", source_file: "test" },
  { software_name: "Google Chrome", version: "120.0.1", source_file: "test" }, // Duplicate
];

// Original logic simulation
function original(deviceSoftware, softwareSearchQuery, deduplicate) {
    let filtered = deviceSoftware

    // Apply search filter
    if (softwareSearchQuery.trim()) {
      const searchLower = softwareSearchQuery.toLowerCase()
      filtered = filtered.filter(
        (sw) =>
          sw.software_name.toLowerCase().includes(searchLower) ||
          sw.version.toLowerCase().includes(searchLower),
      )
    }

    // Apply deduplication if enabled
    if (deduplicate) {
      const seen = new Set<string>()
      filtered = filtered.filter((sw) => {
        const key = `${sw.software_name}|${sw.version || "N/A"}`
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })
    }

    return filtered
}

// Optimized logic simulation
function optimized(deviceSoftware, softwareSearchQuery, deduplicate) {
  // Memoized part
  const preparedSoftware = deviceSoftware.map(sw => ({
      original: sw,
      lowerName: sw.software_name.toLowerCase(),
      lowerVersion: sw.version.toLowerCase(),
      dedupKey: `${sw.software_name}|${sw.version || "N/A"}`
  }));

  let filtered = preparedSoftware

    // Apply search filter
    if (softwareSearchQuery.trim()) {
      const searchLower = softwareSearchQuery.toLowerCase()
      filtered = filtered.filter(
        (item) =>
          item.lowerName.includes(searchLower) ||
          item.lowerVersion.includes(searchLower)
      )
    }

    // Apply deduplication if enabled
    if (deduplicate) {
      const seen = new Set<string>()
      filtered = filtered.filter((item) => {
        if (seen.has(item.dedupKey)) {
          return false
        }
        seen.add(item.dedupKey)
        return true
      })
    }

    return filtered.map(item => item.original)
}

function runTest() {
    console.log("Running test...");

    // Case 1: Search "chrome", deduplicate false
    let res1 = original(deviceSoftware, "chrome", false);
    let res2 = optimized(deviceSoftware, "chrome", false);

    if (JSON.stringify(res1) !== JSON.stringify(res2)) {
        console.error("FAIL: Case 1");
        console.error("Original:", res1);
        console.error("Optimized:", res2);
        process.exit(1);
    }

    // Case 2: Search "chrome", deduplicate true
    res1 = original(deviceSoftware, "chrome", true);
    res2 = optimized(deviceSoftware, "chrome", true);

    if (JSON.stringify(res1) !== JSON.stringify(res2)) {
        console.error("FAIL: Case 2");
        console.error("Original:", res1);
        console.error("Optimized:", res2);
        process.exit(1);
    }

     // Case 3: Empty search, deduplicate true
    res1 = original(deviceSoftware, "", true);
    res2 = optimized(deviceSoftware, "", true);

    if (JSON.stringify(res1) !== JSON.stringify(res2)) {
        console.error("FAIL: Case 3");
        console.error("Original:", res1);
        console.error("Optimized:", res2);
        process.exit(1);
    }

    console.log("SUCCESS: All cases matched");
}

runTest();
