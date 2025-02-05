import { cache } from "decorator-cache-getter";
import { NonNullNativeStruct } from "../../utils/native-struct";

/** Represents a `Il2CppMemorySnapshot`. */
class Il2CppMemorySnapshot extends NonNullNativeStruct {
    /** Captures a memory snapshot. */
    static capture(): Il2Cpp.MemorySnapshot {
        return new Il2Cpp.MemorySnapshot();
    }

    /** Creates a memory snapshot with the given handle. */
    constructor(handle: NativePointer = Il2Cpp.Api._memorySnapshotCapture()) {
        super(handle);
    }

    /** */
    @cache
    get metadataSnapshot(): Il2Cpp.MetadataSnapshot {
        return new Il2Cpp.MetadataSnapshot(Il2Cpp.Api._memorySnapshotGetMetadataSnapshot(this));
    }

    /** Gets the objects tracked by this memory snapshot. */
    @cache
    get objects(): Il2Cpp.Object[] {
        const array: Il2Cpp.Object[] = [];

        const count = this.trackedObjectCount.toNumber();
        const start = Il2Cpp.Api._memorySnapshotGetObjects(this);

        for (let i = 0; i < count; i++) {
            array.push(new Il2Cpp.Object(start.add(i * Process.pointerSize).readPointer()));
        }

        return array;
    }

    /** Gets the amount of objects tracked in this memory snapshot. */
    @cache
    get trackedObjectCount(): UInt64 {
        return Il2Cpp.Api._memorySnapshotGetTrackedObjectCount(this);
    }

    /** Frees this memory snapshot. */
    free(): void {
        Il2Cpp.Api._memorySnapshotFree(this);
    }
}

Il2Cpp.MemorySnapshot = Il2CppMemorySnapshot;

declare global {
    namespace Il2Cpp {
        class MemorySnapshot extends Il2CppMemorySnapshot {}
    }
}
