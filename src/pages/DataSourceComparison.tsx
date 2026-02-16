import React, { useEffect, useState } from "react";
import * as echarts from "echarts";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft,
    ArrowRightLeft,
    BarChart3,
    Calendar,
    CheckCircle2,
    FileText,
    Layers,
    PieChart,
    RefreshCw,
    SlidersHorizontal,
    TrendingUp,
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mockDataService } from "@/services/MockDataService";
import { supabase } from "@/integrations/supabase/client";
import LoggerService from "@/services/LoggerService";
import EChartsWrapper from "@/components/charts/EChartsWrapper";
import { applyPowerBITheme } from "@/lib/powerbi-chart-theme";
import { prepareDistributionData } from "@/lib/comparison-utils";
import { toast } from "sonner";

interface DataSourceData {
    id: string;
    name: string;
    data: any[];
    columns: string[];
    totalRows?: number;
}

const DataSourceComparison = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [source1, setSource1] = useState<DataSourceData | null>(null);
    const [source2, setSource2] = useState<DataSourceData | null>(null);

    // Mapping State: matches source1_col -> source2_col
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>(
        {},
    );
    const [activeTab, setActiveTab] = useState("overview");
    const [selectedSourceCol, setSelectedSourceCol] = useState<string>("");
    const [selectedTargetCol, setSelectedTargetCol] = useState<string>("");

    useEffect(() => {
        const s1Id = searchParams.get("source1");
        const s2Id = searchParams.get("source2");

        if (!s1Id || !s2Id) {
            toast.error("Invalid comparison parameters");
            navigate("/data-sources");
            return;
        }

        loadData(s1Id, s2Id);
    }, [searchParams]);

    const fetchSourceData = async (
        id: string,
    ): Promise<DataSourceData | null> => {
        try {
            // 1. Try Mock Service
            const mockSource = mockDataService.getSources().find((s) =>
                s.id === id
            );
            if (mockSource) {
                const data = mockDataService.getData(id) as any[];
                return {
                    id: mockSource.id,
                    name: mockSource.name,
                    data: data || [],
                    columns: data && data.length > 0
                        ? Object.keys(data[0])
                        : [],
                    totalRows: data?.length || 0,
                };
            }

            // 2. Try Supabase Metadata
            const { data: sourceMeta, error: metaError } = await supabase
                .from("data_sources")
                .select("*")
                .eq("id", id)
                .single();

            if (metaError || !sourceMeta) {
                console.warn("Source metadata not found/error:", metaError);
                return null;
            }

            // 3. Fetch Actual Data Records
            const { data: recordsData, error: recordsError } = await supabase
                .from("data_records")
                .select("row_data")
                .eq("file_id", id)
                .limit(2000);

            if (recordsError) {
                console.error("Error fetching records:", recordsError);
                return null;
            }

            const realData = recordsData?.map((r: any) => r.row_data) || [];

            // Fallback strategies for columns if not in schema_info
            let columns = (sourceMeta.schema_info as any)?.columns || [];
            if (columns.length === 0 && realData.length > 0) {
                columns = Object.keys(realData[0]);
            }

            return {
                id: sourceMeta.id,
                name: sourceMeta.name,
                data: realData,
                columns,
                totalRows: Number(sourceMeta.row_count) || 0, // Pass total count from metadata
            };
        } catch (error) {
            console.error("Error fetching source", id, error);
            return null;
        }
    };

    const loadData = async (id1: string, id2: string) => {
        setLoading(true);
        try {
            const [d1, d2] = await Promise.all([
                fetchSourceData(id1),
                fetchSourceData(id2),
            ]);
            if (!d1 || !d2) {
                toast.error("Could not load one or both data sources");
                return;
            }
            setSource1(d1);
            setSource2(d2);

            // Auto-map columns
            const initialMapping: Record<string, string> = {};
            const d2ColsLower = d2.columns.map((c) => c.toLowerCase());

            d1.columns.forEach((c1) => {
                const c1Lower = c1.toLowerCase();
                const matchIndex = d2ColsLower.indexOf(c1Lower);
                if (matchIndex >= 0) {
                    initialMapping[c1] = d2.columns[matchIndex];
                }
            });
            setColumnMapping(initialMapping);
        } finally {
            setLoading(false);
        }
    };

    // --- Comparison Logic ---

    const getDisplayNames = () => {
        if (!source1 || !source2) return { name1: "", name2: "" };
        const s1Name = source1.name.trim();
        const s2Name = source2.name.trim();

        if (s1Name === s2Name) {
            return {
                name1: `${s1Name} (1)`,
                name2: `${s2Name} (2)`,
            };
        }
        return { name1: s1Name, name2: s2Name };
    };

    const { name1, name2 } = getDisplayNames();

    const getCommonColumns = () => {
        return Object.keys(columnMapping);
    };

    const commonColumns = getCommonColumns();

    // Helper to get matching column name from Source 2
    const getS2Col = (col1: string) => {
        return columnMapping[col1] || null;
    };

    const handleMapColumn = (col1: string, col2: string) => {
        setColumnMapping((prev) => ({
            ...prev,
            [col1]: col2,
        }));
        toast.success(`Mapped ${col1} to ${col2}`);
    };

    const handleUnmapColumn = (col1: string) => {
        setColumnMapping((prev) => {
            const next = { ...prev };
            delete next[col1];
            return next;
        });
    };

    const unmappedSource1 = source1?.columns.filter((c) => !columnMapping[c]) ||
        [];
    const unmappedSource2 =
        source2?.columns.filter((c) =>
            !Object.values(columnMapping).includes(c)
        ) || [];

    // Improved Heuristics for Numeric Columns (handles currency, commas, etc.)
    const numericColumns = commonColumns.filter((col) => {
        if (!source1?.data || source1.data.length === 0) return false;

        // Scan up to 5 rows to find a valid number
        for (let i = 0; i < Math.min(source1.data.length, 5); i++) {
            const rawVal = source1.data[i]?.[col];
            if (rawVal === null || rawVal === undefined || rawVal === "") {
                continue;
            }

            // Cleanup formatting (e.g. "$1,234.56" -> 1234.56)
            const cleanVal = String(rawVal).replace(/[^0-9.-]+/g, "");
            if (cleanVal !== "" && !isNaN(Number(cleanVal))) return true;
        }
        return false;
    });

    const dateColumns = commonColumns.filter((col) => {
        const k = col.toLowerCase();
        return k.includes("date") || k.includes("time") || k.includes("day") ||
            k.includes("year") || k.includes("month");
    });

    // Unified KPI Cards
    const getUnifiedKPIs = () => {
        if (!source1 || !source2) return [];

        const kpis = [];

        // 1. Total Volume
        const totalRows = (source1.totalRows || source1.data.length) +
            (source2.totalRows || source2.data.length);
        kpis.push({
            title: "Total Volume",
            value: totalRows.toLocaleString(),
            icon: Layers,
            color: "text-blue-400",
        });

        // 2. Mapped Numeric Columns Sums
        numericColumns.forEach((col) => {
            const col2 = getS2Col(col);
            if (!col2) return;

            const cleanNumber = (val: any) => {
                if (typeof val === "number") return val;
                const str = String(val).replace(/[^0-9.-]+/g, "");
                return Number(str) || 0;
            };

            const sum1 = source1.data.reduce(
                (a, b) => a + cleanNumber(b[col]),
                0,
            );
            const sum2 = source2.data.reduce(
                (a, b) => a + cleanNumber(b[col2]),
                0,
            );
            const total = sum1 + sum2;

            kpis.push({
                title: `Total ${col}`,
                value: total.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                }),
                subtext: `${name1}: ${
                    sum1.toLocaleString(undefined, { maximumFractionDigits: 0 })
                } | ${name2}: ${
                    sum2.toLocaleString(undefined, { maximumFractionDigits: 0 })
                }`,
                icon: DollarSignIcon(col) ? RefreshCw : BarChart3, // Simple heuristic for icon
                color: "text-green-400",
            });
        });

        return kpis;
    };

    const DollarSignIcon = (col: string) =>
        /price|cost|amount|revenue|sales/i.test(col);

    // Example Chart: Total Rows Comparison
    const getRowsChart = () => {
        if (!source1 || !source2) return {};

        return applyPowerBITheme({
            tooltip: { trigger: "item", formatter: "{b}: {c} records" },
            grid: {
                left: "5%",
                right: "5%",
                top: "15%",
                bottom: "10%",
                containLabel: true,
            },
            xAxis: {
                type: "category",
                data: [name1, name2],
                axisLabel: { color: "#fff", interval: 0, overflow: "break" },
            },
            yAxis: {
                type: "value",
                name: "Record Count",
                axisLabel: { color: "#fff" },
            },
            series: [{
                type: "bar",
                barMaxWidth: 60,
                barWidth: "40%",
                data: [
                    {
                        value: source1.totalRows || source1.data.length,
                        itemStyle: {
                            color: new echarts.graphic.LinearGradient(
                                0,
                                0,
                                0,
                                1,
                                [{ offset: 0, color: "#0EA5E9" }, {
                                    offset: 1,
                                    color: "#0284c7",
                                }],
                            ),
                        },
                        name: name1,
                    },
                    {
                        value: source2.totalRows || source2.data.length,
                        itemStyle: {
                            color: new echarts.graphic.LinearGradient(
                                0,
                                0,
                                0,
                                1,
                                [{ offset: 0, color: "#8B5CF6" }, {
                                    offset: 1,
                                    color: "#7c3aed",
                                }],
                            ),
                        },
                        name: name2,
                    },
                ],
                label: { show: true, position: "top", color: "#fff" },
            }],
        });
    };

    // Example Chart: Metric Comparison
    const getMetricChart = (metric: string) => {
        if (!source1 || !source2) return {};

        const metric2 = getS2Col(metric);

        const cleanNumber = (val: any) => {
            const str = String(val).replace(/[^0-9.-]+/g, "");
            return Number(str) || 0;
        };

        const sum1 = source1.data.reduce(
            (a, b) => a + cleanNumber(b[metric]),
            0,
        );
        const sum2 = source2.data.reduce(
            (a, b) => a + cleanNumber(b[metric2]),
            0,
        );

        return applyPowerBITheme({
            title: {
                text: `Total ${metric}`,
                left: "center",
                textStyle: { color: "#fff" },
            },
            tooltip: { trigger: "item", formatter: "{b}: {c}" },
            grid: {
                left: "5%",
                right: "5%",
                top: "15%",
                bottom: "10%",
                containLabel: true,
            },
            xAxis: {
                type: "category",
                data: [name1, name2],
                axisLabel: { color: "#fff" },
            },
            yAxis: { type: "value", axisLabel: { color: "#fff" } },
            series: [{
                type: "bar",
                barWidth: "50%",
                data: [
                    {
                        value: sum1,
                        itemStyle: { color: "#0EA5E9" },
                        name: name1,
                    },
                    {
                        value: sum2,
                        itemStyle: { color: "#8B5CF6" },
                        name: name2,
                    },
                ],
                label: {
                    show: true,
                    position: "top",
                    color: "#fff",
                    formatter: (p: any) =>
                        typeof p.value === "number"
                            ? p.value.toLocaleString()
                            : p.value,
                },
            }],
        });
    };

    // Categorical Analysis
    const categoricalColumns = commonColumns.filter((col) => {
        const v1 = source1?.data[0]?.[col];
        // Heuristic: String and not typical date column name
        // Check if value is string and not date-like
        const isString = typeof v1 === "string";
        const isNotDate = !/date|time|created|updated/i.test(col);
        return isString && isNotDate;
    });

    const getCategoryChart = (col: string) => {
        if (!source1 || !source2) return {};
        const col2 = getS2Col(col);
        if (!col2) return {};

        return applyPowerBITheme({
            ...prepareDistributionData(
                source1.data,
                source2.data,
                col,
                name1,
                name2,
                col2,
            ),
            xAxis: { axisLabel: { color: "#fff" } },
            yAxis: { axisLabel: { color: "#fff" } },
            legend: { textStyle: { color: "#fff" } },
        } as any);
    };

    return (
        <div className="min-h-screen bg-[#0A0E27] text-white p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            onClick={() => navigate("/data-sources")}
                            className="text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="w-5 h-5 mr-2" /> Back
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                                Comparative Dashboard
                            </h1>
                            <p className="text-gray-400 text-sm mt-1">
                                Comparing{" "}
                                <span className="text-[#00D4FF]">{name1}</span>
                                {" "}
                                vs{" "}
                                <span className="text-[#6B46C1]">{name2}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                            <span className="w-3 h-3 rounded-full bg-[#00D4FF]">
                            </span>
                            <span className="text-sm">{name1}</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                            <span className="w-3 h-3 rounded-full bg-[#6B46C1]">
                            </span>
                            <span className="text-sm">{name2}</span>
                        </div>
                    </div>
                </div>

                {loading
                    ? (
                        <div className="flex flex-col items-center justify-center p-20 h-[60vh]">
                            <RefreshCw className="w-12 h-12 animate-spin text-[#00D4FF] mb-4" />
                            <p className="text-gray-400">
                                Analyzing datasets...
                            </p>
                        </div>
                    )
                    : (
                        <Tabs
                            value={activeTab}
                            onValueChange={setActiveTab}
                            className="space-y-6"
                        >
                            <TabsList className="bg-white/5 border border-white/10 p-1 w-full justify-start">
                                <TabsTrigger
                                    value="overview"
                                    className="data-[state=active]:bg-[#00D4FF]/20 data-[state=active]:text-[#00D4FF]"
                                >
                                    <Layers className="w-4 h-4 mr-2" /> Overview
                                </TabsTrigger>
                                <TabsTrigger
                                    value="mapping"
                                    className="data-[state=active]:bg-[#00D4FF]/20 data-[state=active]:text-[#00D4FF]"
                                >
                                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                                    {" "}
                                    Field Mapping
                                    {unmappedSource1.length > 0 && (
                                        <Badge
                                            variant="secondary"
                                            className="ml-2 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                                        >
                                            {unmappedSource1.length} unmapped
                                        </Badge>
                                    )}
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent
                                value="overview"
                                className="space-y-8 animate-in fade-in slide-in-from-bottom-4"
                            >
                                {/* Unified KPIs */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {getUnifiedKPIs().map((kpi, idx) => (
                                        <Card
                                            key={idx}
                                            className="glass-card border-white/10 p-6 relative overflow-hidden group hover:border-[#00D4FF]/30 transition-all"
                                        >
                                            <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110">
                                            </div>
                                            <div className="relative z-10">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="text-sm font-medium text-gray-400">
                                                        {kpi.title}
                                                    </h3>
                                                    <kpi.icon
                                                        className={`w-5 h-5 ${kpi.color}`}
                                                    />
                                                </div>
                                                <div className="text-3xl font-bold text-white mb-2">
                                                    {kpi.value}
                                                </div>
                                                {kpi.subtext && (
                                                    <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-white/10">
                                                        {kpi.subtext}
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    ))}
                                </div>

                                <div className="space-y-8">
                                    {/* Volume Chart - Full Width */}
                                    <Card className="glass-card border-white/10 p-6">
                                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                                            <Layers className="w-5 h-5 text-blue-400" />
                                            Record Count Comparison
                                        </h2>
                                        <div className="h-[400px] w-full flex items-center justify-center">
                                            <EChartsWrapper
                                                option={getRowsChart()}
                                            />
                                        </div>
                                    </Card>

                                    {/* Metric Comparisons - Grid */}
                                    {numericColumns.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {numericColumns.map((col) => (
                                                <Card
                                                    key={col}
                                                    className="glass-card border-white/10 p-6"
                                                >
                                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                                                        <BarChart3 className="w-5 h-5 text-green-400" />
                                                        {col} Analysis
                                                    </h2>
                                                    <div className="h-[400px] w-full flex items-center justify-center">
                                                        <EChartsWrapper
                                                            option={getMetricChart(
                                                                col,
                                                            )}
                                                        />
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    )}

                                    {/* Categorical Distributions - Stacked */}
                                    {categoricalColumns.length > 0 && (
                                        <div className="space-y-8">
                                            {categoricalColumns.map((col) => (
                                                <Card
                                                    key={col}
                                                    className="glass-card border-white/10 p-6"
                                                >
                                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                                                        <PieChart className="w-5 h-5 text-purple-400" />
                                                        Distribution by {col}
                                                    </h2>
                                                    <div className="h-[400px] w-full">
                                                        <EChartsWrapper
                                                            option={getCategoryChart(
                                                                col,
                                                            )}
                                                        />
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent
                                value="mapping"
                                className="space-y-6 animate-in fade-in slide-in-from-bottom-4"
                            >
                                <Card className="glass-card border-white/10 p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h2 className="text-xl font-bold flex items-center gap-2">
                                                <SlidersHorizontal className="w-5 h-5 text-[#00D4FF]" />
                                                Column Alignment
                                            </h2>
                                            <p className="text-gray-400 text-sm mt-1">
                                                Map columns from {name1} to{" "}
                                                {name2}{" "}
                                                to enable unified analysis.
                                            </p>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="border-green-500/30 text-green-400"
                                        >
                                            {Object.keys(columnMapping).length}
                                            {" "}
                                            Mapped
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        {/* Mapped Columns List */}
                                        <div className="md:col-span-2 space-y-4">
                                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                                                Active Mappings
                                            </h3>
                                            <div className="space-y-2">
                                                {Object.keys(columnMapping)
                                                        .length === 0
                                                    ? (
                                                        <div className="text-center p-8 bg-white/5 rounded-lg border border-dashed border-white/10">
                                                            <p className="text-gray-500">
                                                                No columns
                                                                mapped yet.
                                                            </p>
                                                        </div>
                                                    )
                                                    : (
                                                        Object.entries(
                                                            columnMapping,
                                                        ).map(([c1, c2]) => (
                                                            <div
                                                                key={c1}
                                                                className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 group hover:border-[#00D4FF]/30 transition-colors"
                                                            >
                                                                <div className="flex items-center gap-4 flex-1">
                                                                    <div className="flex-1 text-right font-mono text-sm text-blue-300">
                                                                        {c1}
                                                                    </div>
                                                                    <ArrowRightLeft className="w-4 h-4 text-gray-500" />
                                                                    <div className="flex-1 text-left font-mono text-sm text-purple-300">
                                                                        {c2}
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    onClick={() =>
                                                                        handleUnmapColumn(
                                                                            c1,
                                                                        )}
                                                                >
                                                                    <RefreshCw className="w-4 h-4 rotate-45" />
                                                                    {" "}
                                                                    {/* Use generic icon as X */}
                                                                </Button>
                                                            </div>
                                                        ))
                                                    )}
                                            </div>
                                        </div>

                                        {/* Unmapped Columns & Actions */}
                                        <div className="space-y-6">
                                            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                                <h3 className="text-sm font-semibold text-white mb-4">
                                                    Add New Mapping
                                                </h3>
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <label className="text-xs text-gray-400">
                                                            Column from {name1}
                                                        </label>
                                                        <Select
                                                            onValueChange={setSelectedSourceCol}
                                                            value={selectedSourceCol}
                                                        >
                                                            <SelectTrigger
                                                                id="source-select"
                                                                className="bg-white/10 border-white/20 text-white"
                                                            >
                                                                <SelectValue placeholder="Select column..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {unmappedSource1
                                                                    .map(
                                                                        (c) => (
                                                                            <SelectItem
                                                                                key={c}
                                                                                value={c}
                                                                            >
                                                                                {c}
                                                                            </SelectItem>
                                                                        ),
                                                                    )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-xs text-gray-400">
                                                            Map to {name2}
                                                        </label>
                                                        <Select
                                                            onValueChange={setSelectedTargetCol}
                                                            value={selectedTargetCol}
                                                        >
                                                            <SelectTrigger
                                                                id="target-select"
                                                                className="bg-white/10 border-white/20 text-white"
                                                            >
                                                                <SelectValue placeholder="Select column..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {unmappedSource2
                                                                    .map(
                                                                        (c) => (
                                                                            <SelectItem
                                                                                key={c}
                                                                                value={c}
                                                                            >
                                                                                {c}
                                                                            </SelectItem>
                                                                        ),
                                                                    )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <Button
                                                        className="w-full bg-[#00D4FF]/20 text-[#00D4FF] hover:bg-[#00D4FF]/30 border border-[#00D4FF]/30"
                                                        disabled={!selectedSourceCol ||
                                                            !selectedTargetCol}
                                                        onClick={() => {
                                                            handleMapColumn(
                                                                selectedSourceCol,
                                                                selectedTargetCol,
                                                            );
                                                            setSelectedSourceCol(
                                                                "",
                                                            );
                                                            setSelectedTargetCol(
                                                                "",
                                                            );
                                                        }}
                                                    >
                                                        Link Columns
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    )}
            </div>
        </div>
    );
};

export default DataSourceComparison;
