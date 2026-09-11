import { z } from "zod";
import mongoose from "mongoose";

/**
 * Listing input validation (DEV-SPEC.txt Sections 4, 13).
 *
 * Used by the admin manual-entry route. An admin always submits a COMPLETE
 * listing (the draft flow is the dealer's Phase-4 form), so this validates the
 * full Section 13 ruleset up front for clear field errors; the model's
 * pre-validate hook is the second line of defence.
 */

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), "Invalid id.");

const photo = z.object({
  url: z.string().url(),
  publicId: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  isLowResolution: z.boolean().optional(),
});

const PROPERTY_TYPES = [
  "flat",
  "independent-house",
  "villa",
  "plot",
  "commercial-shop",
  "office",
  "pg",
  "warehouse",
  "farmhouse",
] as const;

const BHK = ["1rk", "1", "2", "3", "4", "5plus"] as const;

export const listingInputSchema = z
  .object({
    // ownership
    dealerId: objectId,

    // basic
    purpose: z.enum(["sale", "rent"]),
    propertyType: z.enum(PROPERTY_TYPES),
    // Dealer's CNT declaration (plots only). Optional boolean, no verification.
    isCntLand: z.boolean().optional(),
    title: z.string().trim().min(5).max(160),
    description: z
      .string()
      .trim()
      .min(100, "Description must be at least 100 characters."),

    // location
    stateId: objectId,
    cityId: objectId,
    localityId: objectId,
    subLocality: z.string().trim().max(120).optional(),
    projectName: z.string().trim().max(160).optional(),
    landmark: z.string().trim().max(200).optional(),
    fullAddress: z.string().trim().max(500).optional(),
    lat: z.number().min(6).max(38),
    lng: z.number().min(68).max(98),
    pincode: z
      .string()
      .trim()
      .regex(/^\d{6}$/)
      .optional(),

    // details
    bhk: z.enum(BHK).optional(),
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
    furnishingDetails: z.array(z.string()).optional(),
    amenities: z.array(z.string()).optional(),
    parking: z.string().trim().max(40).optional(),
    waterSource: z.array(z.string()).optional(),

    // price - sale
    expectedPrice: z.number().positive().optional(),
    priceNegotiable: z.boolean().optional(),
    bookingAmount: z.number().positive().optional(),

    // price - rent
    monthlyRent: z.number().positive().optional(),
    securityDeposit: z.number().min(0).optional(),
    rentNegotiable: z.boolean().optional(),
    preferredTenant: z.array(z.string()).optional(),
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
    approvedBy: z.array(z.string()).optional(),

    // media
    photos: z.array(photo).min(1, "Add at least 1 photo."),
    coverPhotoIndex: z.number().int().min(0).optional(),

    // SEO
    metaTitle: z.string().trim().max(200).optional(),
    metaDescription: z.string().trim().max(400).optional(),

    // admin can file it directly as pending (default) or approved
    status: z.enum(["pending", "approved"]).default("pending"),
  })
  .superRefine((data, ctx) => {
    if (data.purpose === "sale" && !data.expectedPrice) {
      ctx.addIssue({
        code: "custom",
        path: ["expectedPrice"],
        message: "expectedPrice is required for a sale listing.",
      });
    }
    if (data.purpose === "rent" && !data.monthlyRent) {
      ctx.addIssue({
        code: "custom",
        path: ["monthlyRent"],
        message: "monthlyRent is required for a rent listing.",
      });
    }
    if (data.possessionStatus === "under-construction") {
      if (!data.reraNumber) {
        ctx.addIssue({
          code: "custom",
          path: ["reraNumber"],
          message: "reraNumber is required for under-construction.",
        });
      }
      if (!data.reraStateId) {
        ctx.addIssue({
          code: "custom",
          path: ["reraStateId"],
          message: "reraStateId is required for under-construction.",
        });
      }
    }
    if (data.propertyType === "plot") {
      if (data.bhk) {
        ctx.addIssue({
          code: "custom",
          path: ["bhk"],
          message: "A plot cannot have BHK.",
        });
      }
      if (data.bathrooms != null) {
        ctx.addIssue({
          code: "custom",
          path: ["bathrooms"],
          message: "A plot cannot have bathrooms.",
        });
      }
      if (data.floor != null) {
        ctx.addIssue({
          code: "custom",
          path: ["floor"],
          message: "A plot cannot have a floor.",
        });
      }
    }
    if (data.coverPhotoIndex != null && data.coverPhotoIndex >= data.photos.length) {
      ctx.addIssue({
        code: "custom",
        path: ["coverPhotoIndex"],
        message: "coverPhotoIndex is out of range.",
      });
    }
  });

export type ListingInput = z.infer<typeof listingInputSchema>;
