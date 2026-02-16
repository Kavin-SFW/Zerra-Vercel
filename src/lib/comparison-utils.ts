export const prepareDistributionData = (
    source1: any[],
    source2: any[],
    col1: string,
    name1: string,
    name2: string,
    col2?: string,
) => {
    // Helper to count frequency
    const getFrequency = (data: any[], key: string) => {
        const map = new Map<string, number>();
        data.forEach((item) => {
            const val = String(item[key] || "Unknown");
            const finalVal = val === "undefined" || val === "null"
                ? "Unknown"
                : val;
            map.set(finalVal, (map.get(finalVal) || 0) + 1);
        });
        return map;
    };

    const freq1 = getFrequency(source1, col1);
    const freq2 = getFrequency(source2, col2 || col1);

    // Get top categories from both (merged)
    const allKeys = new Set([...freq1.keys(), ...freq2.keys()]);
    // sort by total count
    const sortedKeys = Array.from(allKeys).sort((a, b) => {
        const countA = (freq1.get(a) || 0) + (freq2.get(a) || 0);
        const countB = (freq1.get(b) || 0) + (freq2.get(b) || 0);
        return countB - countA;
    }).slice(0, 8); // Top 8

    return {
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        legend: { data: [name1, name2] },
        grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
        xAxis: { type: "value", boundaryGap: [0, 0.01] },
        yAxis: { type: "category", data: sortedKeys },
        series: [
            {
                name: name1,
                type: "bar",
                data: sortedKeys.map((k) => freq1.get(k) || 0),
                itemStyle: { color: "#0EA5E9" },
            },
            {
                name: name2,
                type: "bar",
                data: sortedKeys.map((k) => freq2.get(k) || 0),
                itemStyle: { color: "#8B5CF6" },
            },
        ],
    };
};
