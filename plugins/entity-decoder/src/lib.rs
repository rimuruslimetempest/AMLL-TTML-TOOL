use serde_json::Value;
use std::mem;
use std::slice;

fn decode_entity(entity: &str) -> Option<char> {
    match entity {
        "amp" => Some('&'),
        "lt" => Some('<'),
        "gt" => Some('>'),
        "quot" => Some('"'),
        "apos" => Some('\''),
        "nbsp" => Some('\u{00A0}'),
        _ => {
            if let Some(hex) = entity
                .strip_prefix("#x")
                .or_else(|| entity.strip_prefix("#X"))
            {
                u32::from_str_radix(hex, 16)
                    .ok()
                    .and_then(char::from_u32)
            } else if let Some(decimal) = entity.strip_prefix('#') {
                decimal.parse::<u32>().ok().and_then(char::from_u32)
            } else {
                None
            }
        }
    }
}

fn decode_text(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(index) = rest.find('&') {
        out.push_str(&rest[..index]);
        let after = &rest[index + 1..];
        if let Some(end) = after.find(';') {
            let entity = &after[..end];
            if entity.len() <= 12 {
                if let Some(decoded) = decode_entity(entity) {
                    out.push(decoded);
                    rest = &after[end + 1..];
                    continue;
                }
            }
        }
        // Not a known entity: keep the ampersand and continue after it.
        out.push('&');
        rest = after;
    }
    out.push_str(rest);
    out
}

fn transform(input: &str) -> String {
    let mut value: Value = match serde_json::from_str(input) {
        Ok(value) => value,
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
                                Value::String(decode_text(&text)),
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
