import { raise, warn } from "../utils/console";
import { filterMapArray, mapToArray } from "../utils/record";
import { NativeStruct } from "../utils/native-struct";

// function check(value: Il2Cpp.Parameter.Type, type: Il2Cpp.Type): void {
//     function execute(): boolean {
//         if (type.isByReference) {
//             return value instanceof Il2Cpp.Reference;
//         }
//
//         switch (type.typeEnum) {
//             case "boolean":
//                 return typeof value == "boolean";
//             case "i1":
//             case "u1":
//             case "i2":
//             case "u2":
//             case "i4":
//             case "u4":
//             case "char":
//             case "r4":
//             case "r8":
//                 return typeof value == "number";
//             case "i8":
//                 return value instanceof Int64;
//             case "u8":
//                 return value instanceof UInt64;
//             case "i":
//             case "u":
//                 return value instanceof NativePointer;
//             case "ptr":
//                 return value instanceof Il2Cpp.Pointer;
//             case "valuetype":
//                 return value instanceof Il2Cpp.ValueType;
//             case "object":
//                 return value instanceof Il2Cpp.Object;
//             case "string":
//                 return value instanceof Il2Cpp.String;
//             case "szarray":
//                 return value instanceof Il2Cpp.Array;
//         }
//
//         raise(`${type.name} - ${type} has not been handled yet. Please file an issue!`);
//     }
//
//     if (!execute()) {
//         raise(`A "${type.name}" is required, but a "${Object.getPrototypeOf(value).constructor.name}" was supplied.`);
//     }
// }

/** @internal */
export function read(pointer: NativePointer, type: Il2Cpp.Type): Il2Cpp.Field.Type {
    // inform(`Reading a ${type.name} (${type.typeEnum}) from ${pointer}`);
    switch (type.typeEnum) {
        case "boolean":
            return !!pointer.readS8();
        case "i1":
            return pointer.readS8();
        case "u1":
            return pointer.readU8();
        case "i2":
            return pointer.readS16();
        case "u2":
            return pointer.readU16();
        case "i4":
            return pointer.readS32();
        case "u4":
            return pointer.readU32();
        case "char":
            return pointer.readU16();
        case "i8":
            return pointer.readS64();
        case "u8":
            return pointer.readU64();
        case "r4":
            return pointer.readFloat();
        case "r8":
            return pointer.readDouble();
        case "i":
        case "u":
            return pointer.readPointer();
        case "ptr":
            return new Il2Cpp.Pointer(pointer.readPointer(), type.dataType!);
        case "valuetype":
            console.log("!!!", pointer);
            return new Il2Cpp.ValueType(pointer, type);
        case "object":
        case "class":
        case "genericinst":
            return new Il2Cpp.Object(pointer.readPointer());
        case "string":
            return new Il2Cpp.String(pointer.readPointer());
        case "szarray":
        case "array":
            return new Il2Cpp.Array(pointer.readPointer());
    }

    raise(`read: "${type.name}" (${type.typeEnum}) has not been handled yet. Please file an issue!`);
}

/** @internal */
export function write(pointer: NativePointer, value: any, type: Il2Cpp.Type): NativePointer {
    // inform(`Writing ${value} as a ${type.name} (${type.typeEnum}) to ${pointer}`);
    if (type.isByReference) {
        return pointer.writePointer(value);
    }

    switch (type.typeEnum) {
        case "boolean":
            return pointer.writeU8(+value);
        case "i1":
            return pointer.writeS8(value);
        case "u1":
            return pointer.writeU8(value);
        case "i2":
            return pointer.writeS16(value);
        case "u2":
            return pointer.writeU16(value);
        case "i4":
            return pointer.writeS32(value);
        case "u4":
            return pointer.writeU32(value);
        case "char":
            return pointer.writeU16(value);
        case "i8":
            return pointer.writeS64(value);
        case "u8":
            return pointer.writeU64(value);
        case "r4":
            return pointer.writeFloat(value);
        case "r8":
            return pointer.writeDouble(value);
        case "i":
        case "u":
        case "ptr":
        case "valuetype":
        case "string":
        case "object":
        case "class":
        case "szarray":
        case "array":
        case "genericinst":
            return pointer.writePointer(value);
    }

    raise(`write: "${type.name}" (${type.typeEnum}) has not been handled yet. Please file an issue!`);
}

/** @internal */
export function fromFridaValue(value: NativeReturnValue, type: Il2Cpp.Type): Il2Cpp.Parameter.Type | Il2Cpp.Method.ReturnType {
    if (Array.isArray(value)) {
        return arrayToValueType(type, value);
    } else if (value instanceof NativePointer) {
        if (type.isByReference) {
            return new Il2Cpp.Reference(value, type);
        }

        switch (type.typeEnum) {
            case "ptr":
                return new Il2Cpp.Pointer(value, type.dataType!);
            case "string":
                return new Il2Cpp.String(value);
            case "class":
            case "genericinst":
            case "object":
                return new Il2Cpp.Object(value);
            case "szarray":
            case "array":
                return new Il2Cpp.Array(value);
            default:
                return value;
        }
    } else if (type.typeEnum == "boolean") {
        return !!(value as number);
    } else {
        return value;
    }
}

/** @internal */
export function toFridaValue(value: Il2Cpp.Parameter.Type): NativeArgumentValue {
    if (typeof value == "boolean") {
        return +value;
    } else if (value instanceof Il2Cpp.ValueType) {
        return valueTypeToArray(value);
    } else {
        return value;
    }
}

function valueTypeToArray(value: Il2Cpp.ValueType): any[] {
    return mapToArray(value.fields, (field: Il2Cpp.Field) => {
        const fieldValue = field.value;
        return fieldValue instanceof Il2Cpp.ValueType
            ? valueTypeToArray(fieldValue)
            : fieldValue instanceof NativeStruct
            ? fieldValue.handle
            : typeof fieldValue == "boolean"
            ? +fieldValue
            : fieldValue;
    });
}

function arrayToValueType(type: Il2Cpp.Type, nativeValues: any[]): Il2Cpp.ValueType {
    function expandType(type: Il2Cpp.Type): Il2Cpp.Type[] {
        if (type.typeEnum == "valuetype") {
            return filterMapArray(
                type.class.fields,
                (field: Il2Cpp.Field) => !field.isStatic,
                (field: Il2Cpp.Field) => expandType(field.type)
            ).flat();
        } else {
            return [type];
        }
    }

    const types = expandType(type);
    const valueType = Memory.alloc(type.class.instanceSize - Il2Cpp.Object.headerSize);
    nativeValues = nativeValues.flat();

    for (let i = 0, offset = 0; i < nativeValues.length; offset += types[i].class.arrayElementSize, i++) {
        const pointer = valueType.add(offset);
        const value = nativeValues[i];

        switch (types[i].typeEnum) {
            case "boolean":
                pointer.writeU8(value);
                break;
            case "i1":
                pointer.writeS8(value);
                break;
            case "u1":
                pointer.writeU8(value);
                break;
            case "i2":
                pointer.writeS16(value);
                break;
            case "u2":
                pointer.writeU16(value);
                break;
            case "i4":
                pointer.writeS32(value);
                break;
            case "u4":
                pointer.writeU32(value);
                break;
            case "char":
                pointer.writeU16(value);
                break;
            case "i8":
                pointer.writeS64(value);
                break;
            case "u8":
                pointer.writeU64(value);
                break;
            case "r4":
                pointer.writeFloat(value);
                break;
            case "r8":
                pointer.writeDouble(value);
                break;
            case "i":
            case "u":
            case "ptr":
            case "szarray":
            case "array":
            case "string":
            case "object":
            case "class":
            case "genericinst":
                pointer.writePointer(value);
                break;
            default:
                warn(`arrayToValueType: defaulting ${types[i].typeEnum}, ${type.name} to pointer`);
                pointer.writePointer(value);
                break;
        }
    }

    return new Il2Cpp.ValueType(valueType, type);
}
