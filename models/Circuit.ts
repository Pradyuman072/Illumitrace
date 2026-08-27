import mongoose from "mongoose";

const CircuitSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: "Untitled Circuit",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    schematicComponents: {
      type: Array,
      default: [],
    },
    pcbComponents: {
      type: Array,
      default: [],
    },
    connections: {
      type: Array,
      default: [],
    },
  },
  { timestamps: true }
);

CircuitSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.models.Circuit || mongoose.model("Circuit", CircuitSchema);
