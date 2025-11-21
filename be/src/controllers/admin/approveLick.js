import Lick from "../../models/Lick.js";

// Get pending licks for admin
export const getPendingLicks = async (req, res) => {
  try {
    const licks = await Lick.find({ status: "pending" })
      .populate("userId", "username displayName avatarUrl")
      .sort({ createdAt: 1 }); 

    res.status(200).json({
      success: true,
      data: licks,
    });
  } catch (error) {
    console.error("Error fetching pending licks:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Approve a lick
export const approveLick = async (req, res) => {
  try {
    const { lickId } = req.params;
    
    const lick = await Lick.findByIdAndUpdate(
      lickId,
      { 
        status: "active", 
        isPublic: true 
      },
      { new: true }
    );

    if (!lick) {
      return res.status(404).json({ success: false, message: "Lick not found" });
    }

    res.status(200).json({
      success: true,
      message: "Lick approved successfully",
      data: lick
    });
  } catch (error) {
    console.error("Error approving lick:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Reject a lick
export const rejectLick = async (req, res) => {
  try {
    const { lickId } = req.params;
    
    const lick = await Lick.findByIdAndUpdate(
      lickId,
      { 
        status: "inactive",
        isPublic: false 
      },
      { new: true }
    );

    if (!lick) {
      return res.status(404).json({ success: false, message: "Lick not found" });
    }

    res.status(200).json({
      success: true,
      message: "Lick rejected",
      data: lick
    });
  } catch (error) {
    console.error("Error rejecting lick:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};