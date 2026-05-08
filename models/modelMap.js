const ConstructionLog = require('../models/construction_log');
const EquipmentLog = require('../models/equipment_log');
const QualityAcceptance = require('../models/quality_acceptance');
const SafetyHazard = require('../models/safety_hazard');
const MaterialAcceptance = require('../models/material_acceptance');
const InspectionRecord = require('../models/inspection_record');

const modelMap = {
    constructionLog: ConstructionLog,
    equipmentLog: EquipmentLog,
    qualityAcceptance: QualityAcceptance,
    safetyHazard: SafetyHazard,
    materialAcceptance: MaterialAcceptance,
    inspectionRecord: InspectionRecord
}

module.exports = ModelMap;