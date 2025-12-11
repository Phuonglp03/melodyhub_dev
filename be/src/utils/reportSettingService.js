import SystemSetting from '../models/SystemSetting.js';

const REPORT_LIMIT_KEY = 'postReportLimit';
const DEFAULT_REPORT_LIMIT = Number(process.env.REPORT_AUTO_ARCHIVE_LIMIT || 2);

export const getReportLimit = async () => {
  const setting = await SystemSetting.findOne({ key: REPORT_LIMIT_KEY });
  const limit = Number(setting?.value);

  if (Number.isInteger(limit) && limit > 0) {
    return limit;
  }

  return DEFAULT_REPORT_LIMIT;
};

export const upsertReportLimit = async (limit) => {
  const updated = await SystemSetting.findOneAndUpdate(
    { key: REPORT_LIMIT_KEY },
    {
      value: limit,
      description: 'Minimum pending reports before a post is auto-archived',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return Number(updated.value);
};

