export const wrap = (source) => `
const __mdnObservations = [];
const __mdnRecord = (...values) => {
  __mdnObservations.push(JSON.stringify(values, (name, value) => {
    if (typeof value === "undefined") return { __mdnType: "undefined" };
    if (typeof value === "function") return { __mdnType: "function", name: value.name, length: value.length };
    if (typeof value === "symbol") return { __mdnType: "symbol", value: value === Symbol.iterator ? "Symbol.iterator" : value === Symbol.asyncIterator ? "Symbol.asyncIterator" : String(value) };
    if (typeof value === "number" && !Number.isFinite(value)) return { __mdnType: "number", value: String(value) };
    return value;
  }));
};
const console = { log: __mdnRecord, info: __mdnRecord, warn: __mdnRecord, error: __mdnRecord };
let __mdnException = null;
try {
${source}
} catch (__mdnError) {
  __mdnException = __mdnError.name;
}
return JSON.stringify({ observations: __mdnObservations, exception: __mdnException });
`
