import { z } from "zod";
import mongoose from "mongoose";

/**
 * Dealer listing input (DEV-SPEC.txt Sections 4, 13).
 *
 * Deliberately LENIENT: every field is optional so a partial DRAFT can be saved
 * between the 8 form steps. The hard Section 13 rules (description >= 100,
 * photos >= 3, sale/rent price, under-construction RERA, plot restrictions) are
 * enforced by the Listing model's pre-validate hook when the listing is
 * submitted (status leaves 'draft'), so they live in exactly one place.
 *
 * `dealerId` and `status` are NOT accepted from the client - the route sets the
 * owner from the session and derives the status.
 */

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), "Invalid id.");

const photo = z.object({
  url: z.string().url(),
  publicId: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const media = z
  .object({ url: z.string().url(), publicId: z.string().optional(), duration: z.number().optional() })
  .partial()
  .optional();

export const PROPERTY_TYPES = [
  "flat",
  "independent-house",
  "villa",
  "plot",
  "commercial-shop",
  "office",
  "pg",
  "warehouse",
] as const;

export const BHK_VALUES = ["1rk", "1", "2", "3", "4", "5plus"] as const;

export const dealerListingSchema = z.object({
  // basic
  purpose: z.enum(["sale", "rent"]).optional(),
  propertyType: z.enum(PROPERTY_TYPES).optional(),
  // Dealer's CNT declaration (plots only). Optional boolean, no verification.
  isCntLand: z.boolean().optional(),
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().max(8000).optional(),

  // location
  stateId: objectId.optional(),
  cityId: objectId.optional(),
  localityId: objectId.optional(),
  subLocality: z.string().trim().max(120).optional(),
  projectName: z.string().trim().max(160).optional(),
  landmark: z.string().trim().max(200).optional(),
  fullAddress: z.string().trim().max(500).optional(),
  lat: z.number().min(6).max(38).optional(),
  lng: z.number().min(68).max(98).optional(),
  pincode: z.string().trim().regex(/^\d{6}$/).optional(),

  // details
  bhk: z.enum(BHK_VALUES).optional(),
  bathrooms: z.number().int().min(0).max(20).optional(),
  balconies: z.number().int().min(0).max(20).optional(),
  carpetArea: z.number().positive().optional(),
  builtUpArea: z.number().positive().optional(),
  superBuiltUpArea: z.number().positive().optional(),
  plotArea: z.number().positive().optional(),
  floor: z.number().int().min(0).max(200).optional(),
  totalFloors: z.number().int().min(0).max(200).optional(),
  facing: z.string().trim().max(40).optional(),
  ageOfProperty: z.string().trim().max(40).optional(),

  // furnishing
  furnishing: z.enum(["furnished", "semi-furnished", "unfurnished"]).optional(),
  furnishingDetails: z.array(z.string().max(60)).max(40).optional(),
  amenities: z.array(z.string().max(60)).max(60).optional(),
  parking: z.string().trim().max(40).optional(),
  waterSource: z.array(z.string().max(40)).max(10).optional(),

  // price - sale
  expectedPrice: z.number().positive().optional(),
  priceNegotiable: z.boolean().optional(),
  bookingAmount: z.number().positive().optional(),

  // price - rent
  monthlyRent: z.number().positive().optional(),
  securityDeposit: z.number().min(0).optional(),
  rentNegotiable: z.boolean().optional(),
  preferredTenant: z.array(z.string().max(40)).max(10).optional(),
  availableFrom: z.coerce.date().optional(),
  minLeasePeriod: z.string().trim().max(40).optional(),

  // common
  maintenanceCharge: z.number().min(0).optional(),
  brokerage: z.string().trim().max(80).optional(),

  // legal
  possessionStatus: z.string().trim().max(40).optional(),
  possessionDate: z.coerce.date().optional(),
  ownershipType: z.string().trim().max(40).optional(),
  reraNumber: z.string().trim().max(80).optional(),
  reraStateId: objectId.optional(),

  // media
  photos: z.array(photo).max(15).optional(),
  coverPhotoIndex: z.number().int().min(0).optional(),
  video: media,
  floorPlan: media,

  // SEO
  metaTitle: z.string().trim().max(200).optional(),
  metaDescription: z.string().trim().max(400).optional(),
});

export type DealerListingInput = z.infer<typeof dealerListingSchema>;

/** The request wrapper: listing fields plus whether this is a final submit. */
export const dealerListingRequestSchema = dealerListingSchema.extend({
  submit: z.boolean().default(false),
});
