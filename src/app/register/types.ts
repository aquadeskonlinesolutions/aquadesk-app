export type RegistrationConfig = {
  error?: string;
  dive_center?: {
    id: string;
    name: string;
    logo_url: string | null;
    waiver_content: string | null;
    offers_dive_insurance: boolean;
    insurance_referral_link: string | null;
  };
  medical_questions?: { id: string; question_text: string }[];
  equipment_rental_rates?: {
    id: string;
    item_name: string;
    rate: number;
    charge_type: string;
  }[];
  privacy_notice?: string | null;
  group?: {
    id: string;
    group_name: string;
    leader_name: string | null;
    arrival_date: string | null;
    expected_count: number | null;
    registered_count: number;
  };
};

export const CERTIFICATION_LEVELS = [
  "None",
  "Open Water Diver",
  "Advanced Open Water",
  "Rescue Diver",
  "Divemaster",
  "Instructor",
] as const;

export const TRAINING_AGENCIES = ["PADI", "SSI", "NAUI", "CMAS", "Other"] as const;

export const RELATIONSHIPS = [
  "Spouse",
  "Parent",
  "Sibling",
  "Child",
  "Friend",
  "Other",
] as const;

export const CERT_LEVEL_TO_DB: Record<string, string> = {
  None: "none",
  "Open Water Diver": "open_water_diver",
  "Advanced Open Water": "advanced_open_water",
  "Rescue Diver": "rescue_diver",
  Divemaster: "divemaster",
  Instructor: "instructor",
};

export const AGENCY_TO_DB: Record<string, string> = {
  PADI: "padi",
  SSI: "ssi",
  NAUI: "naui",
  CMAS: "cmas",
  Other: "other",
};
