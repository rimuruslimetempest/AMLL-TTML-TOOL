import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const catalog = JSON.parse(
	readFileSync(
		join(root, "src", "modules", "plugins", "official-plugins.json"),
		"utf8",
	),
);

if (!Array.isArray(catalog.plugins) || catalog.plugins.length === 0) {
	throw new Error("No official plugins found. Run pnpm plugins:build first.");
}

const cases = {
	"whitespace-cleaner": {
		input: "  hello\u200b  ",
		expected: " hello ",
	},
	"entity-decoder": {
		input: "&amp; &#39; &#x1F600;",
		expected: "& ' 😀",
	},
};

function sampleLines(word) {
	return [
		{
			id: "line-1",
			startTime: 1000,
			endTime: 2000,
			words: [
				{ id: "word-1", startTime: 1000, endTime: 1500, word },
				{ id: "word-2", startTime: 1500, endTime: 2000, word: "second" },
			],
		},
	];
}

function runTool(instance, lines) {
	const exports = instance.exports;
	assert.equal(typeof exports.allocate, "function");
	assert.equal(typeof exports.run_tool, "function");
	assert.ok(exports.memory instanceof WebAssembly.Memory);
	const encoded = new TextEncoder().encode(JSON.stringify(lines));
	const ptr = exports.allocate(encoded.length);
	assert.ok(ptr, "allocate returned a null pointer");
	new Uint8Array(exports.memory.buffer).set(encoded, ptr);
	const resultPtr = exports.run_tool(ptr, encoded.length);
	exports.deallocate?.(ptr, encoded.length);
	assert.ok(resultPtr, "run_tool returned a null pointer");
	const memory = new Uint8Array(exports.memory.buffer);
	let end = resultPtr;
	while (end < memory.length && memory[end] !== 0) end++;
	assert.ok(end < memory.length, "run_tool result was not terminated");
	return JSON.parse(new TextDecoder().decode(memory.slice(resultPtr, end)));
}

let tested = 0;
for (const entry of catalog.plugins) {
	const testCase = cases[entry.id];
	assert.ok(testCase, `No smoke-test case for ${entry.id}`);
	const wasmPath = join(root, "public", entry.download.replace(/^\//, ""));
	const bytes = readFileSync(wasmPath);
	const digest = createHash("sha256").update(bytes).digest("hex");
	assert.equal(digest, entry.sha256, `${entry.id} hash does not match catalog`);
	assert.equal(bytes.byteLength, entry.size, `${entry.id} size does not match`);
	assert.deepEqual([...bytes.subarray(0, 4)], [0x00, 0x61, 0x73, 0x6d]);

	const { instance } = await WebAssembly.instantiate(bytes, {
		env: { log: () => {} },
	});
	const input = sampleLines(testCase.input);
	const result = runTool(instance, input);
	assert.ok(Array.isArray(result), `${entry.id} did not return an array`);
	assert.equal(result.length, input.length, `${entry.id} changed line count`);
	assert.equal(
		result[0].words[0].word,
		testCase.expected,
		`${entry.id} produced unexpected text`,
	);
	assert.deepEqual(
		result[0].words.map((word) => [word.id, word.startTime, word.endTime]),
		input[0].words.map((word) => [word.id, word.startTime, word.endTime]),
		`${entry.id} changed word IDs or timings`,
	);
	assert.equal(result[0].startTime, input[0].startTime);
	assert.equal(result[0].endTime, input[0].endTime);
	console.log(`ok ${entry.id} (${entry.size} bytes)`);
	tested += 1;
}

console.log(`Official plugin smoke test passed for ${tested} plugin(s).`);
