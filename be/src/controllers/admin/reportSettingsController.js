import { getReportLimit, upsertReportLimit } from '../../services/reportSettingService.js';

const MIN_LIMIT = 1;
const MAX_LIMIT = 20;

export const getReportLimitSetting = async (req, res) => {
  try {
    const limit = await getReportLimit();
    res.status(200).json({
      success: true,
      data: {
        limit,
      },
    });
  } catch (error) {
    console.error('Error getting report limit setting:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load report limit',
    });
  }
};

export const updateReportLimitSetting = async (req, res) => {
  try {
    const { limit } = req.body;
    const parsedLimit = Number(limit);

    if (!Number.isInteger(parsedLimit) || parsedLimit < MIN_LIMIT || parsedLimit > MAX_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `Report limit must be an integer between ${MIN_LIMIT} and ${MAX_LIMIT}`,
      });
    }

    const savedLimit = await upsertReportLimit(parsedLimit);

    res.status(200).json({
      success: true,
      message: 'Report limit updated successfully',
      data: {
        limit: savedLimit,
      },
    });
  } catch (error) {
    console.error('Error updating report limit setting:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update report limit',
    });
  }
};


