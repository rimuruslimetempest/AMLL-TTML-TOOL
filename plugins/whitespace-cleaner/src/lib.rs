use serde_json::Value;
use std::mem;
use std::slice;

fn normalize_text(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut last_was_space = false;
    for ch in text.chars() {
        if matches!(ch, '\u{200B}' | '\u{200C}' | '\u{200D}' | '\u{FEFF}') {
            continue;
        }
        if ch.is_whitespace() {
            // Keep one leading/trailing space so two syllables are never glued
            // together, but collapse runs inside the token.
            if !last_was_space {
                out.push(' ');
                last_was_space = true;
            }
        } else {
            out.push(ch);
            last_was_space = false;
        }
    }
    out
}

fn transform(input: &str) -> String {
    let mut value: Value = match serde_json::from_str(input) {
        Ok(value) => value,
        // A malformed input is returned unchanged. The host sent it, so the
        // timing guard still sees the original document.
        Err(_) => return input.to_string(),
    };
    if let Some(lines) = value.as_array_mut() {
        for line in lines.iter_mut() {
            if let Some(words) = line.get_mut("words").and_then(Value::as_array_mut) {
                for word in words.iter_mut() {
                    if let Some(object) = word.as_object_mut() {
                        if let Some(Value::String(text)) = object.get("word").cloned() {
                            object.insert(
                                "word".to_string(),
                                Value::String(normalize_text(&text)),
                            );
                        }
                    }
                }
            }
        }
    }
    serde_json::to_string(&value).unwrap_or_else(|_| input.to_string())
}

#[no_mangle]
pub extern "C" fn allocate(size: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(size);
    let ptr = buffer.as_mut_ptr();
    mem::forget(buffer);
    ptr
}

#[no_mangle]
pub extern "C" fn deallocate(ptr: *mut u8, size: usize) {
    unsafe {
        drop(Vec::from_raw_parts(ptr, 0, size));
    }
}

#[no_mangle]
pub extern "C" fn run_tool(ptr: *const u8, len: usize) -> *mut u8 {
    let input = unsafe { slice::from_raw_parts(ptr, len) };
    let text = std::str::from_utf8(input).unwrap_or("");
    let mut output = transform(text).into_bytes();
    output.push(0);
    let ptr = output.as_mut_ptr();
    mem::forget(output);
    ptr
}
