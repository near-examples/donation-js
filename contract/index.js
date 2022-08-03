function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
  var desc = {};
  Object.keys(descriptor).forEach(function (key) {
    desc[key] = descriptor[key];
  });
  desc.enumerable = !!desc.enumerable;
  desc.configurable = !!desc.configurable;

  if ('value' in desc || desc.initializer) {
    desc.writable = true;
  }

  desc = decorators.slice().reverse().reduce(function (desc, decorator) {
    return decorator(target, property, desc) || desc;
  }, desc);

  if (context && desc.initializer !== void 0) {
    desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
    desc.initializer = undefined;
  }

  if (desc.initializer === void 0) {
    Object.defineProperty(target, property, desc);
    desc = null;
  }

  return desc;
}

function call(target, key, descriptor) {}
function view(target, key, descriptor) {}
function NearBindgen(target) {
  return class extends target {
    static _init() {
      // @ts-ignore
      let args = target.deserializeArgs();
      let ret = new target(args); // @ts-ignore

      ret.serialize();
      return ret;
    }

    static _get() {
      let ret = Object.create(target.prototype);
      return ret;
    }

  };
}

const U64_MAX = 2n ** 64n - 1n;
const EVICTED_REGISTER = U64_MAX - 1n;
function log(...params) {
  env.log(`${params.map(x => x === undefined ? 'undefined' : x) // Stringify undefined
  .map(x => typeof x === 'object' ? JSON.stringify(x) : x) // Convert Objects to strings
  .join(' ')}` // Convert to string
  );
}
function predecessorAccountId() {
  env.predecessor_account_id(0);
  return env.read_register(0);
}
function attachedDeposit() {
  return env.attached_deposit();
}
function storageRead(key) {
  let ret = env.storage_read(key, 0);

  if (ret === 1n) {
    return env.read_register(0);
  } else {
    return null;
  }
}
function storageGetEvicted() {
  return env.read_register(EVICTED_REGISTER);
}

function currentAccountId() {
  env.current_account_id(0);
  return env.read_register(0);
}
function input() {
  env.input(0);
  return env.read_register(0);
}
function promiseBatchCreate(accountId) {
  return env.promise_batch_create(accountId);
}
function promiseBatchActionTransfer(promiseIndex, amount) {
  env.promise_batch_action_transfer(promiseIndex, amount);
}
var PromiseResult;

(function (PromiseResult) {
  PromiseResult[PromiseResult["NotReady"] = 0] = "NotReady";
  PromiseResult[PromiseResult["Successful"] = 1] = "Successful";
  PromiseResult[PromiseResult["Failed"] = 2] = "Failed";
})(PromiseResult || (PromiseResult = {}));
function storageWrite(key, value) {
  let exist = env.storage_write(key, value, EVICTED_REGISTER);

  if (exist === 1n) {
    return true;
  }

  return false;
}
function storageRemove(key) {
  let exist = env.storage_remove(key, EVICTED_REGISTER);

  if (exist === 1n) {
    return true;
  }

  return false;
}

class NearContract {
  deserialize() {
    let state = storageRead("STATE");

    if (state) {
      Object.assign(this, JSON.parse(state));
    } else {
      throw new Error("Contract state is empty");
    }
  }

  serialize() {
    storageWrite("STATE", JSON.stringify(this));
  }

  static deserializeArgs() {
    let args = input();
    return JSON.parse(args || "{}");
  }

  static serializeReturn(ret) {
    return JSON.stringify(ret);
  }

}

const toSerialize = Symbol("serialize");
const toDeserialize = Symbol("deserialize");

// deno-lint-ignore-file no-explicit-any
function serialize(value, options = {}) {
  let output = "";
  let inc = 0;
  const prettify = options.prettify ?? false;
  let depth = 0;
  const objectMap = new Map();
  const objectIndexMap = new Map();

  function _stringifyString(value) {
    output += `"${value.replace('"', '\\"')}"`; // " 문자는 escape 해야합니다.

    return true;
  }

  function _stringifyScalar(value) {
    if (value === null) {
      output += "null";
      return true;
    }

    const typeofValue = typeof value;

    if (typeofValue === "undefined") {
      output += "undefined";
      return true;
    }

    if (typeofValue === "number") {
      if (Number.isNaN(value)) {
        output += "NaN";
        return true;
      }

      if (!Number.isFinite(value)) {
        output += value > 0 ? "Infinity" : "-Infinity";
        return true;
      }

      output += `${value}`;
      return true;
    }

    if (typeofValue === "bigint") {
      output += `${value}n`;
      return true;
    }

    if (typeofValue === "boolean") {
      output += value ? "true" : "false";
      return true;
    }

    if (typeofValue === "string") {
      return _stringifyString(value);
    }

    return false;
  }

  function _stringifyRoot(value) {
    if (_stringifyScalar(value)) {
      return true;
    }

    return _stringifyRef(value);
  }

  function _stringifyAny(value) {
    if (_stringifyScalar(value)) {
      return true;
    }

    let oIdx = objectIndexMap.get(value);

    if (typeof oIdx !== "number") {
      oIdx = inc++;
      objectIndexMap.set(value, oIdx);
      objectMap.set(oIdx, value);
    }

    output += `$${oIdx}`;
    return true;
  }

  function _stringifyRef(value) {
    // simple :-)
    if (typeof value === "symbol") {
      output += "Symbol(";

      if (value.description) {
        _stringifyString(value.description);
      }

      output += ")";
      return true;
    }

    if (value instanceof RegExp) {
      output += value.toString();
      return true;
    }

    if (value instanceof Date) {
      output += "Date(";

      _stringifyAny(value.getTime());

      output += ")";
      return true;
    } // complex :D


    if (prettify) {
      output += "  ".repeat(depth);
    }

    if (Array.isArray(value)) {
      _stringifyListStart("[");

      _stringifyList(value);

      _stringifyListEnd("]");

      return true;
    }

    if (value instanceof Map) {
      _stringifyListStart("Map(");

      _stringifyMap([...value.entries()]);

      _stringifyListEnd(")");

      return true;
    }

    if (value instanceof Set) {
      _stringifyListStart("Set(");

      _stringifyList([...value]);

      _stringifyListEnd(")");

      return true;
    }

    const name = value.constructor !== Object && value.constructor !== Function ? value.constructor.name : "";

    _stringifyListStart(prettify && name ? `${name} {` : `${name}{`);

    _stringifyKv(Object.entries(typeof value[toSerialize] === "function" ? value[toSerialize]() : value));

    _stringifyListEnd("}");

    return true;
  }

  const _stringifyListStart = prettify ? name => {
    output += name;
    output += "\n";
    depth++;
  } : name => {
    output += name;
    depth++;
  };

  const _stringifyListEnd = prettify ? name => {
    depth--;
    output += "\n";
    output += "  ".repeat(depth);
    output += name;
  } : name => {
    depth--;
    output += name;
  };

  const _stringifyList = prettify ? value => {
    for (let i = 0; i < value.length; i++) {
      if (i > 0) {
        output += ",\n";
      }

      output += "  ".repeat(depth);

      _stringifyAny(value[i]);
    }
  } : value => {
    for (let i = 0; i < value.length; i++) {
      if (i > 0) {
        output += ",";
      }

      _stringifyAny(value[i]);
    }
  };

  const _stringifyMap = prettify ? value => {
    for (let i = 0; i < value.length; i++) {
      if (i > 0) {
        output += ",\n";
      }

      output += "  ".repeat(depth);

      _stringifyAny(value[i][0]);

      output += " => ";

      _stringifyAny(value[i][1]);
    }
  } : value => {
    for (let i = 0; i < value.length; i++) {
      if (i > 0) {
        output += ",";
      }

      _stringifyAny(value[i][0]);

      output += "=>";

      _stringifyAny(value[i][1]);
    }
  };

  const _stringifyKv = prettify ? value => {
    for (let i = 0; i < value.length; i++) {
      if (i > 0) {
        output += ",\n";
      }

      output += "  ".repeat(depth);

      _stringifyString(value[i][0]);

      output += ": ";

      _stringifyAny(value[i][1]);
    }
  } : value => {
    for (let i = 0; i < value.length; i++) {
      if (i > 0) {
        output += ",";
      }

      _stringifyString(value[i][0]);

      output += ":";

      _stringifyAny(value[i][1]);
    }
  };

  inc++;
  objectIndexMap.set(value, 0);
  objectMap.set(0, value);

  _stringifyRoot(value);

  for (let i = 1; i < inc; i++) {
    output += ";";

    if (prettify) {
      output += "\n";
    }

    _stringifyRoot(objectMap.get(i));
  }

  return output;
}

const NUM_CHARS = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
let buf = "";
let pos = 0;

function consume(s) {
  for (const c of s) {
    if (buf[pos] !== c) {
      throw error();
    }

    pos++;
  }
}

function white() {
  while (1) {
    switch (buf[pos]) {
      case "\t":
      case "\v":
      case "\f":
      case " ":
      case "\u00A0":
      case "\uFEFF":
      case "\n":
      case "\r":
      case "\u2028":
      case "\u2029":
        pos++;
        break;

      default:
        return;
    }
  }
}

function error() {
  return new SyntaxError(`Unexpected ${buf[pos] ? `token ${buf[pos]}` : "end"} in SuperSerial at position ${pos}`);
}

function parseAny() {
  white();

  if (buf[pos] === "$") {
    pos++;
    let result = "";

    while (NUM_CHARS.has(buf[pos])) {
      result += buf[pos++];
    }

    return [64, +result];
  }

  return parseRoot();
}

function parseRoot() {
  white();

  switch (buf[pos]) {
    case "-":
    case "0":
    case "1":
    case "2":
    case "3":
    case "4":
    case "5":
    case "6":
    case "7":
    case "8":
    case "9":
      {
        return parseNumber();
      }

    case '"':
      return parseString();

    case "[":
      return parseArray();

    case "/":
      return parseRegExp();

    default:
      {
        const name = keyword();

        switch (name) {
          case "null":
            return [1];

          case "true":
            return [2, true];

          case "false":
            return [2, false];
        }

        if (buf[pos] === "{") {
          return parseObject(name);
        }

        switch (name) {
          case "undefined":
            return [0];

          case "NaN":
            return [3, NaN];

          case "Infinity":
            return [3, Infinity];
        }

        if (buf[pos] === "(") {
          switch (name) {
            case "Map":
              return parseMap();

            case "Set":
              return parseSet();

            case "Date":
              return parseDate();

            case "Symbol":
              return parseSymbol();

            default:
              throw error();
          }
        }
      }
  }

  throw error();
}

function parseNumber() {
  let result = "";
  let mult = 1;

  if (buf[pos] === "-") {
    pos++;
    mult = -1;
  }

  if (buf[pos] === "I") {
    pos++;
    consume("nfinity");
    return [3, mult * Infinity];
  }

  if (NUM_CHARS.has(buf[pos])) {
    result += buf[pos++];
  } else {
    throw error();
  }

  while (NUM_CHARS.has(buf[pos])) {
    result += buf[pos++];
  }

  if (buf[pos] === "n") {
    pos++;
    return [4, BigInt(result) * BigInt(mult)];
  } else {
    if (buf[pos] === ".") {
      result += buf[pos++];

      while (NUM_CHARS.has(buf[pos])) {
        result += buf[pos++];
      }
    }

    if (buf[pos] === "e" || buf[pos] === "E") {
      result += buf[pos++];

      if (buf[pos] === "-" || buf[pos] === "+") {
        result += buf[pos++];
      }

      if (NUM_CHARS.has(buf[pos])) {
        result += buf[pos++];
      } else {
        throw error();
      }

      while (NUM_CHARS.has(buf[pos])) {
        result += buf[pos++];
      }
    }
  }

  return [3, +result * mult];
}

function parseString() {
  let result = "";
  pos++;

  while (1) {
    switch (buf[pos]) {
      case '"':
        pos++;
        return [5, result];

      case "\\":
        pos++;

        switch (buf[pos]) {
          case "u":
            {
              pos++;
              let uffff = 0;

              for (let i = 0; i < 4; i++) {
                const hex = parseInt(buf[pos], 16);

                if (!isFinite(hex)) {
                  throw error();
                }

                pos++;
                uffff = uffff * 16 + hex;
              }

              result += String.fromCharCode(uffff);
              continue;
            }

          case '"':
            pos++;
            result += '"';
            continue;

          case "\\":
            pos++;
            result += "\\";
            continue;

          case "b":
            pos++;
            result += "\b";
            continue;

          case "f":
            pos++;
            result += "\f";
            continue;

          case "n":
            pos++;
            result += "\n";
            continue;

          case "r":
            pos++;
            result += "\r";
            continue;

          case "t":
            pos++;
            result += "\t";
            continue;
        }

        break;

      default:
        result += buf[pos++];
        continue;
    }

    break;
  }

  throw error();
}

function parseArray() {
  pos++;
  white();

  if (buf[pos] === "]") {
    pos++;
    return [16, []];
  }

  const result = [];
  result.push(parseAny());
  white();

  while (buf[pos] === ",") {
    pos++;
    result.push(parseAny());
    white();
  }

  if (buf[pos] === "]") {
    pos++;
    return [16, result];
  }

  throw error();
}

function parseObject(name = null) {
  pos++;
  white();

  if (buf[pos] === "}") {
    pos++;
    return [17, name, []];
  }

  const result = [];

  while (1) {
    const key = parseString(); // TODO Symbol

    white();

    if (buf[pos] !== ":") {
      throw error();
    }

    pos++;
    result.push([key, parseAny()]);
    white();

    if (buf[pos] === ",") {
      pos++;
      white();
      continue;
    }

    if (buf[pos] === "}") {
      pos++;
      return [17, name, result];
    }

    break;
  }

  throw error();
}

function parseRegExp() {
  pos++;
  let pattern = "";

  if (buf[pos] === "/") {
    throw error();
  }

  while (buf[pos]) {
    if (buf[pos] === "/") {
      pos++;

      switch (buf[pos]) {
        case "i":
          {
            pos++;

            switch (buf[pos]) {
              case "m":
                {
                  pos++;

                  if (buf[pos] === "g") {
                    pos++;
                    return [32, pattern, "img"];
                  } else {
                    return [32, pattern, "im"];
                  }
                }

              case "g":
                {
                  pos++;

                  if (buf[pos] === "m") {
                    pos++;
                    return [32, pattern, "igm"];
                  } else {
                    return [32, pattern, "ig"];
                  }
                }

              default:
                {
                  return [32, pattern, "i"];
                }
            }
          }

        case "m":
          {
            pos++;

            switch (buf[pos]) {
              case "i":
                {
                  pos++;

                  if (buf[pos] === "g") {
                    pos++;
                    return [32, pattern, "mig"];
                  } else {
                    return [32, pattern, "mi"];
                  }
                }

              case "g":
                {
                  pos++;

                  if (buf[pos] === "i") {
                    pos++;
                    return [32, pattern, "mgi"];
                  } else {
                    return [32, pattern, "mg"];
                  }
                }

              default:
                {
                  return [32, pattern, "m"];
                }
            }
          }

        case "g":
          {
            pos++;

            switch (buf[pos]) {
              case "m":
                {
                  pos++;

                  if (buf[pos] === "i") {
                    pos++;
                    return [32, pattern, "gmi"];
                  } else {
                    return [32, pattern, "gm"];
                  }
                }

              case "i":
                {
                  pos++;

                  if (buf[pos] === "m") {
                    pos++;
                    return [32, pattern, "gim"];
                  } else {
                    return [32, pattern, "gi"];
                  }
                }

              default:
                {
                  return [32, pattern, "g"];
                }
            }
          }
      }

      return [32, pattern, null];
    } else if (buf[pos] === "\\") {
      pattern += buf[pos++];
      pattern += buf[pos++];
    } else {
      pattern += buf[pos++];
    }
  }

  throw error();
}

function parseSet() {
  pos++;
  white();

  if (buf[pos] === ")") {
    pos++;
    return [34, []];
  }

  const items = [];
  items.push(parseAny());
  white();

  while (buf[pos] === ",") {
    pos++;
    items.push(parseAny());
    white();
  }

  if (buf[pos] === ")") {
    pos++;
    return [34, items];
  }

  throw error();
}

function parseMap() {
  pos++;
  white();

  if (buf[pos] === ")") {
    pos++;
    return [35, []];
  }

  const entries = [];

  while (1) {
    const key = parseAny();
    white();
    consume("=>");
    white();
    const value = parseAny();
    entries.push([key, value]);
    white();

    if (buf[pos] === ",") {
      pos++;
      white();
      continue;
    }

    if (buf[pos] === ")") {
      pos++;
      break;
    }

    throw error();
  }

  return [35, entries];
}

function parseSymbol() {
  pos++;
  white();

  if (buf[pos] === ")") {
    pos++;
    return [6, null];
  }

  if (buf[pos] === '"') {
    const valueString = parseString();
    white();

    if (buf[pos] === ")") {
      pos++;
      return [6, valueString[1]];
    }
  }

  throw error();
}

function parseDate() {
  pos++;
  white();
  let value = "";
  let mult = 1;

  if (buf[pos] === "-") {
    pos++;
    mult = -1;
  }

  if (NUM_CHARS.has(buf[pos])) {
    value += buf[pos++];
  } else {
    throw error();
  }

  while (NUM_CHARS.has(buf[pos])) {
    value += buf[pos++];
  }

  if (buf[pos] === ".") {
    value += buf[pos++];

    while (NUM_CHARS.has(buf[pos])) {
      value += buf[pos++];
    }
  }

  if (buf[pos] === "e" || buf[pos] === "E") {
    value += buf[pos++];

    if (buf[pos] === "-" || buf[pos] === "+") {
      value += buf[pos++];
    }

    if (NUM_CHARS.has(buf[pos])) {
      value += buf[pos++];
    } else {
      throw error();
    }

    while (NUM_CHARS.has(buf[pos])) {
      value += buf[pos++];
    }
  }

  white();

  if (buf[pos] === ")") {
    pos++;
    return [33, +value * mult];
  }

  throw error();
}

function keyword() {
  let chartCode = buf.charCodeAt(pos);
  let result = "";

  if (chartCode >= 65 && chartCode <= 90 || // UPPERCASE
  chartCode >= 97 && chartCode <= 122 || // lowercase
  chartCode === 95 // _
  ) {
    result += buf[pos++];
  } else {
    return null;
  }

  while (chartCode = buf.charCodeAt(pos)) {
    if (chartCode >= 65 && chartCode <= 90 || // UPPERCASE
    chartCode >= 97 && chartCode <= 122 || // lowercase
    chartCode >= 48 && chartCode <= 57 || // number
    chartCode === 95 // _
    ) {
      result += buf[pos++];
    } else {
      break;
    }
  }

  white();
  return result;
}

function parse(ctx) {
  buf = ctx;
  pos = 0;
  const roots = [];
  roots.push(parseRoot());
  white();

  while (buf[pos] === ";") {
    pos++;
    roots.push(parseRoot());
    white();
  }

  if (buf.length !== pos) {
    throw error();
  }

  return roots;
}

// deno-lint-ignore-file no-explicit-any
function deserialize(ctx, options = {}) {
  const mapClasses = options.classes ?? {};
  const refs = [];
  const valueMap = new Map();
  const resolvers = [];

  function transformAstAny(ast) {
    if (ast[0] === 64) {
      const index = ast[1];

      if (index in refs) {
        return refs[index];
      }

      throw new Error(`not found ref $${index}`);
    }

    return transformAstRoot(ast);
  }

  function transformAstRoot(ast) {
    const value = valueMap.get(ast);

    if (value) {
      return value;
    }

    switch (ast[0]) {
      case 0:
        return undefined;

      case 1:
        return null;

      case 2: // boolean

      case 3: // number

      case 4: // bigint

      case 5:
        // string
        return ast[1];

      case 6:
        {
          const value = typeof ast[1] === "string" ? Symbol(ast[1]) : Symbol();
          valueMap.set(ast, value);
          return value;
        }

      case 16:
        {
          const value = [];
          valueMap.set(ast, value);
          const items = ast[1];
          resolvers.push(() => {
            value.push(...items.map(transformAstAny));
          });
          return value;
        }

      case 17:
        {
          const name = ast[1];
          const entries = ast[2];
          const baseClass = name ? mapClasses[name] ?? null : null;

          if (name && !baseClass) {
            console.warn(`Class ${name} is not defined. It will be ignored.`);
          }

          const value = baseClass ? Reflect.construct(baseClass, []) : {};
          valueMap.set(ast, value);
          resolvers.push(() => {
            const merged = Object.fromEntries(entries.map(([k, v]) => [k[1], transformAstAny(v)]));

            if (typeof value[toDeserialize] === "function") {
              value[toDeserialize](merged);
            } else {
              Object.assign(value, merged);
            }
          });
          return value;
        }

      case 32:
        {
          const value = ast[2] ? new RegExp(ast[1], ast[2]) : new RegExp(ast[1]);
          valueMap.set(ast, value);
          return value;
        }

      case 33:
        {
          const value = new Date(ast[1]);
          valueMap.set(ast, value);
          return value;
        }

      case 34:
        {
          const value = new Set();
          valueMap.set(ast, value);
          const items = ast[1];
          resolvers.push(() => {
            for (const item of items) {
              value.add(transformAstAny(item));
            }
          });
          return value;
        }

      case 35:
        {
          const value = new Map();
          valueMap.set(ast, value);
          const entries = ast[1];
          resolvers.push(() => {
            for (const [k, v] of entries) {
              value.set(transformAstAny(k), transformAstAny(v));
            }
          });
          return value;
        }
    }

    throw new Error(`wrong ast type(${ast[0]})`);
  }

  for (const [rootIndex, root] of parse(ctx).entries()) {
    refs[rootIndex] = transformAstRoot(root);
  }

  let resolver;

  while (resolver = resolvers.shift()) {
    resolver();
  }

  return refs[0];
}

// deno-lint-ignore-file no-explicit-any
class Serializer {
  constructor(options) {
    Object.defineProperty(this, "options", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: options
    });
  }

  serialize(value, options) {
    return serialize(value, options);
  }

  deserialize(code) {
    return deserialize(code, this.options);
  }

}

function u8ArrayToBytes(array) {
  let ret = "";

  for (let e of array) {
    ret += String.fromCharCode(e);
  }

  return ret;
} // TODO this function is a bit broken and the type can't be string
// TODO for more info: https://github.com/near/near-sdk-js/issues/78

function bytesToU8Array(bytes) {
  let ret = new Uint8Array(bytes.length);

  for (let i = 0; i < bytes.length; i++) {
    ret[i] = bytes.charCodeAt(i);
  }

  return ret;
}

const ERR_INDEX_OUT_OF_BOUNDS = "Index out of bounds";
const ERR_INCONSISTENT_STATE$1 = "The collection is an inconsistent state. Did previous smart contract execution terminate unexpectedly?";

function indexToKey(prefix, index) {
  let data = new Uint32Array([index]);
  let array = new Uint8Array(data.buffer);
  let key = u8ArrayToBytes(array);
  return prefix + key;
} /// An iterable implementation of vector that stores its content on the trie.
/// Uses the following map: index -> element


class Vector {
  constructor(prefix, classes) {
    this.length = 0;
    this.prefix = prefix;
    this.serializer = new Serializer({
      classes
    });
  }

  len() {
    return this.length;
  }

  isEmpty() {
    return this.length == 0;
  }

  get(index) {
    if (index >= this.length) {
      return null;
    }

    let storageKey = indexToKey(this.prefix, index);
    return this.serializer.deserialize(storageRead(storageKey));
  } /// Removes an element from the vector and returns it in serialized form.
  /// The removed element is replaced by the last element of the vector.
  /// Does not preserve ordering, but is `O(1)`.


  swapRemove(index) {
    if (index >= this.length) {
      throw new Error(ERR_INDEX_OUT_OF_BOUNDS);
    } else if (index + 1 == this.length) {
      return this.pop();
    } else {
      let key = indexToKey(this.prefix, index);
      let last = this.pop();

      if (storageWrite(key, this.serializer.serialize(last))) {
        return this.serializer.deserialize(storageGetEvicted());
      } else {
        throw new Error(ERR_INCONSISTENT_STATE$1);
      }
    }
  }

  push(element) {
    let key = indexToKey(this.prefix, this.length);
    this.length += 1;
    storageWrite(key, this.serializer.serialize(element));
  }

  pop() {
    if (this.isEmpty()) {
      return null;
    } else {
      let lastIndex = this.length - 1;
      let lastKey = indexToKey(this.prefix, lastIndex);
      this.length -= 1;

      if (storageRemove(lastKey)) {
        return this.serializer.deserialize(storageGetEvicted());
      } else {
        throw new Error(ERR_INCONSISTENT_STATE$1);
      }
    }
  }

  replace(index, element) {
    if (index >= this.length) {
      throw new Error(ERR_INDEX_OUT_OF_BOUNDS);
    } else {
      let key = indexToKey(this.prefix, index);

      if (storageWrite(key, this.serializer.serialize(element))) {
        return this.serializer.deserialize(storageGetEvicted());
      } else {
        throw new Error(ERR_INCONSISTENT_STATE$1);
      }
    }
  }

  extend(elements) {
    for (let element of elements) {
      this.push(element);
    }
  }

  [Symbol.iterator]() {
    return new VectorIterator(this);
  }

  clear() {
    for (let i = 0; i < this.length; i++) {
      let key = indexToKey(this.prefix, i);
      storageRemove(key);
    }

    this.length = 0;
  }

  toArray() {
    let ret = [];

    for (let v of this) {
      ret.push(v);
    }

    return ret;
  }

}
class VectorIterator {
  constructor(vector) {
    this.current = 0;
    this.vector = vector;
  }

  next() {
    if (this.current < this.vector.len()) {
      let value = this.vector.get(this.current);
      this.current += 1;
      return {
        value,
        done: false
      };
    }

    return {
      value: null,
      done: true
    };
  }

}

const ERR_INCONSISTENT_STATE = "The collection is an inconsistent state. Did previous smart contract execution terminate unexpectedly?";
class UnorderedMap {
  constructor(prefix, classes) {
    this.length = 0;
    this.keyIndexPrefix = prefix + "i";
    let indexKey = prefix + "k";
    let indexValue = prefix + "v";
    this.keys = new Vector(indexKey, classes);
    this.values = new Vector(indexValue, classes);
    this.serializer = new Serializer(classes);
  }

  len() {
    let keysLen = this.keys.len();
    let valuesLen = this.values.len();

    if (keysLen != valuesLen) {
      throw new Error(ERR_INCONSISTENT_STATE);
    }

    return keysLen;
  }

  isEmpty() {
    let keysIsEmpty = this.keys.isEmpty();
    let valuesIsEmpty = this.values.isEmpty();

    if (keysIsEmpty != valuesIsEmpty) {
      throw new Error(ERR_INCONSISTENT_STATE);
    }

    return keysIsEmpty;
  }

  serializeIndex(index) {
    let data = new Uint32Array([index]);
    let array = new Uint8Array(data.buffer);
    return u8ArrayToBytes(array);
  }

  deserializeIndex(rawIndex) {
    let array = bytesToU8Array(rawIndex);
    let data = new Uint32Array(array.buffer);
    return data[0];
  }

  getIndexRaw(key) {
    let indexLookup = this.keyIndexPrefix + this.serializer.serialize(key);
    let indexRaw = storageRead(indexLookup);
    return indexRaw;
  }

  get(key) {
    let indexRaw = this.getIndexRaw(key);

    if (indexRaw) {
      let index = this.deserializeIndex(indexRaw);
      let value = this.values.get(index);

      if (value) {
        return value;
      } else {
        throw new Error(ERR_INCONSISTENT_STATE);
      }
    }

    return null;
  }

  set(key, value) {
    let indexLookup = this.keyIndexPrefix + this.serializer.serialize(key);
    let indexRaw = storageRead(indexLookup);

    if (indexRaw) {
      let index = this.deserializeIndex(indexRaw);
      return this.values.replace(index, value);
    } else {
      let nextIndex = this.len();
      let nextIndexRaw = this.serializeIndex(nextIndex);
      storageWrite(indexLookup, nextIndexRaw);
      this.keys.push(key);
      this.values.push(value);
      return null;
    }
  }

  remove(key) {
    let indexLookup = this.keyIndexPrefix + this.serializer.serialize(key);
    let indexRaw = storageRead(indexLookup);

    if (indexRaw) {
      if (this.len() == 1) {
        // If there is only one element then swap remove simply removes it without
        // swapping with the last element.
        storageRemove(indexLookup);
      } else {
        // If there is more than one element then swap remove swaps it with the last
        // element.
        let lastKey = this.keys.get(this.len() - 1);

        if (!lastKey) {
          throw new Error(ERR_INCONSISTENT_STATE);
        }

        storageRemove(indexLookup); // If the removed element was the last element from keys, then we don't need to
        // reinsert the lookup back.

        if (lastKey != key) {
          let lastLookupKey = this.keyIndexPrefix + this.serializer.serialize(lastKey);
          storageWrite(lastLookupKey, indexRaw);
        }
      }

      let index = this.deserializeIndex(indexRaw);
      this.keys.swapRemove(index);
      return this.values.swapRemove(index);
    }

    return null;
  }

  clear() {
    for (let key of this.keys) {
      let indexLookup = this.keyIndexPrefix + this.serializer.serialize(key);
      storageRemove(indexLookup);
    }

    this.keys.clear();
    this.values.clear();
  }

  toArray() {
    let ret = [];

    for (let v of this) {
      ret.push(v);
    }

    return ret;
  }

  [Symbol.iterator]() {
    return new UnorderedMapIterator(this);
  }

  extend(kvs) {
    for (let [k, v] of kvs) {
      this.set(k, v);
    }
  }

}

class UnorderedMapIterator {
  constructor(unorderedMap) {
    this.keys = new VectorIterator(unorderedMap.keys);
    this.values = new VectorIterator(unorderedMap.values);
  }

  next() {
    let key = this.keys.next();
    let value = this.values.next();

    if (key.done != value.done) {
      throw new Error(ERR_INCONSISTENT_STATE);
    }

    return {
      value: [key.value, value.value],
      done: key.done
    };
  }

}

function assert(statement, message) {
  if (!statement) {
    throw Error(`Assertion failed: ${message}`);
  }
}
function make_private() {
  assert(predecessorAccountId() == currentAccountId(), "This is a private method");
}

const STORAGE_COST = BigInt("1000000000000000000000");
class Donation {
  constructor({
    account_id,
    total_amount
  }) {
    this.account_id = account_id;
    this.total_amount = total_amount;
  }

}

var _class, _class2;
const PREFIX = "p";

let HelloNear = NearBindgen(_class = (_class2 = class HelloNear extends NearContract {
  constructor({
    beneficiary = "v1.faucet.nonofficial.testnet"
  }) {
    super();
    this.beneficiary = beneficiary;
    this.donations = new UnorderedMap(PREFIX);
  }

  deserialize() {
    super.deserialize();
    this.donations.keys = Object.assign(new Vector(PREFIX + 'k'), this.donations.keys);
    this.donations.values = Object.assign(new Vector(PREFIX + 'v'), this.donations.values);
    this.donations = Object.assign(new UnorderedMap(PREFIX), this.donations);
  }

  donate() {
    // Get who is calling the method and how much $NEAR they attached
    let donor = predecessorAccountId();
    let donationAmount = attachedDeposit().valueOf();
    let currentDonation = this.donations.get(donor) || new Donation({
      account_id: donor,
      total_amount: BigInt(0)
    });
    let donatedSoFar = currentDonation.total_amount;
    let toTransfer = donationAmount; // This is the user's first donation, lets register it, which increases storage

    if (donatedSoFar.toString() === "0") {
      assert(donationAmount > STORAGE_COST, `Attach at least ${STORAGE_COST} yoctoNEAR`); // Subtract the storage cost to the amount to transfer

      toTransfer -= STORAGE_COST;
    } // Persist in storage the amount donated so far


    donatedSoFar += donationAmount;
    currentDonation.total_amount = donatedSoFar;
    this.donations.set(donor, currentDonation);
    log(`Thank you ${donor} for donating ${donationAmount}! You donated a total of ${donatedSoFar}`); // Send the money to the beneficiary (TODO)

    const promise = promiseBatchCreate(this.beneficiary);
    promiseBatchActionTransfer(promise, toTransfer); // Return the total amount donated so far

    return donatedSoFar.toString();
  }

  change_beneficiary({
    beneficiary
  }) {
    make_private();
    this.beneficiary = beneficiary;
  }

  get_beneficiary() {
    return this.beneficiary;
  }

  total_donations() {
    return this.donations.len();
  }

  get_donations({
    from_index = 0,
    limit = 50
  }) {
    // Loop through the donations and return the ones that are in the range
    let donationsArray = this.donations.toArray();
    let actualLimit = Math.min(limit, donationsArray.length - from_index);
    let donations = [];

    for (let i = from_index; i < actualLimit; i++) {
      donations.push(donationsArray[i][1]);
    }

    return donations;
  }

  get_donation_for_account({
    account_id
  }) {
    return new Donation({
      account_id: account_id,
      total_amount: this.donations.get(account_id).total_amount || BigInt(0)
    });
  }

}, (_applyDecoratedDescriptor(_class2.prototype, "donate", [call], Object.getOwnPropertyDescriptor(_class2.prototype, "donate"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "change_beneficiary", [call], Object.getOwnPropertyDescriptor(_class2.prototype, "change_beneficiary"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_beneficiary", [view], Object.getOwnPropertyDescriptor(_class2.prototype, "get_beneficiary"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "total_donations", [view], Object.getOwnPropertyDescriptor(_class2.prototype, "total_donations"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_donations", [view], Object.getOwnPropertyDescriptor(_class2.prototype, "get_donations"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_donation_for_account", [view], Object.getOwnPropertyDescriptor(_class2.prototype, "get_donation_for_account"), _class2.prototype)), _class2)) || _class;

function init() {
  HelloNear._init();
}
function get_donation_for_account() {
  let _contract = HelloNear._get();

  _contract.deserialize();

  let args = _contract.constructor.deserializeArgs();

  let ret = _contract.get_donation_for_account(args);
  if (ret !== undefined) env.value_return(_contract.constructor.serializeReturn(ret));
}
function get_donations() {
  let _contract = HelloNear._get();

  _contract.deserialize();

  let args = _contract.constructor.deserializeArgs();

  let ret = _contract.get_donations(args);
  if (ret !== undefined) env.value_return(_contract.constructor.serializeReturn(ret));
}
function total_donations() {
  let _contract = HelloNear._get();

  _contract.deserialize();

  let args = _contract.constructor.deserializeArgs();

  let ret = _contract.total_donations(args);
  if (ret !== undefined) env.value_return(_contract.constructor.serializeReturn(ret));
}
function get_beneficiary() {
  let _contract = HelloNear._get();

  _contract.deserialize();

  let args = _contract.constructor.deserializeArgs();

  let ret = _contract.get_beneficiary(args);
  if (ret !== undefined) env.value_return(_contract.constructor.serializeReturn(ret));
}
function change_beneficiary() {
  let _contract = HelloNear._get();

  _contract.deserialize();

  let args = _contract.constructor.deserializeArgs();

  let ret = _contract.change_beneficiary(args);

  _contract.serialize();

  if (ret !== undefined) env.value_return(_contract.constructor.serializeReturn(ret));
}
function donate() {
  let _contract = HelloNear._get();

  _contract.deserialize();

  let args = _contract.constructor.deserializeArgs();

  let ret = _contract.donate(args);

  _contract.serialize();

  if (ret !== undefined) env.value_return(_contract.constructor.serializeReturn(ret));
}

export { change_beneficiary, donate, get_beneficiary, get_donation_for_account, get_donations, init, total_donations };
//# sourceMappingURL=index.js.map
