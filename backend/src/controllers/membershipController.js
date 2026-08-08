const membershipService = require("../services/membershipService");
const { handleError } = require("../utils/httpError");

async function buyMembership(req, res) {
  try {
    const userId = req.user?.id;

    console.log("Membership purchase request:", req.body);

    const { package_id } = req.body || {};

    const packageIdNum = Number(package_id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!Number.isFinite(packageIdNum) || packageIdNum <= 0) {
      return res.status(400).json({ message: "Invalid package_id" });
    }


    const result = await membershipService.buyMembership({ userId, packageId: packageIdNum });
    return res.status(200).json({
      success: true,
      message: result?.message || "Membership activated successfully",
      package_id: result?.package_id,
      funds_source: result?.funds_source,
    });

  } catch (error) {
    const status = error.statusCode || 500;
    return handleError(res, error, "Membership purchase failed");
  }
}

async function getMembershipStatus(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const result = await membershipService.getMembershipStatus(userId);
    return res.json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    return handleError(res, error, "Failed to fetch membership status");
  }
}

async function getCurrentMembership(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const result = await membershipService.getCurrentMembership(userId);
    return res.json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    return handleError(res, error, "Failed to fetch current membership");
  }
}

async function getUserPackages(req, res) {
  try {
    const result = await membershipService.getUserPackages();
    return res.json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    return handleError(res, error, "Failed to fetch user packages");
  }
}

async function getProviderPackages(req, res) {
  try {
    const result = await membershipService.getProviderPackages();
    return res.json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    return handleError(res, error, "Failed to fetch provider packages");
  }
}

async function cancelMembership(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const result = await membershipService.cancelMembership({ userId });
    return res.status(200).json({
      success: true,
      message: "Membership canceled successfully"
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return handleError(res, error, "Failed to cancel membership");
  }
}

module.exports = {
  buyMembership,
  getMembershipStatus,
  getCurrentMembership,
  getUserPackages,
  getProviderPackages,
  cancelMembership,
};


