/**
 * DEV-ONLY: seed one published demo blog post so /blog and /blog/[slug] have
 * content to render (and appear in the blog sitemap). Idempotent by slug.
 *
 *   npm run seed:demo-blog
 */
import "@/scripts/load-env";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Blog } from "@/lib/db/models/Blog";
import { City } from "@/lib/db/models/City";

const SLUG = "buying-property-in-ranchi-a-first-timer-guide";

const CONTENT = `
<p>Ranchi has quietly become one of eastern India's most approachable property markets. Whether you are buying your first home or a plot to build on later, a little groundwork goes a long way. This guide walks through what actually matters.</p>
<h2>1. Pick the right locality first</h2>
<p>Price follows location more than anything else. Established pockets like Kanke, Lalpur and Hinoo offer schools, hospitals and reliable connectivity, while newer stretches reward buyers willing to wait for infrastructure to catch up.</p>
<h2>2. Understand the paperwork</h2>
<p>Before you pay any token amount, confirm the essentials:</p>
<ul>
  <li>Clear, marketable title in the seller's name</li>
  <li>Up-to-date property tax receipts</li>
  <li>Approved building plan (for flats and houses)</li>
  <li>Encumbrance certificate showing no pending loans</li>
</ul>
<h2>3. Compare on carpet area, not super built-up</h2>
<p>Two flats quoted at the same price can differ by 15-20% in usable space. Always ask for the carpet area and compare on that number.</p>
<blockquote>A dependable market rewards patience: see several options, ask for documents early, and never rush a token payment.</blockquote>
<h2>4. Contact dealers directly</h2>
<p>On NivaasBhoomi every listing has a WhatsApp button - message the verified dealer directly, ask for a site visit, and negotiate on your terms. No spam calls, no hidden numbers.</p>
`.trim();

async function main() {
  await connectDB();
  const ranchi = await City.findOne({ slug: "ranchi" }, { _id: 1 }).lean();

  const existing = await Blog.findOne({ slug: SLUG });
  if (existing) {
    // Keep it published + ensure it has content (idempotent refresh).
    existing.status = "published";
    if (!existing.content) existing.content = CONTENT;
    if (ranchi && !existing.cityId) existing.cityId = ranchi._id;
    await existing.save();
    console.log(`✓ Demo blog already present (/blog/${SLUG}) - ensured published.`);
  } else {
    await Blog.create({
      title: "Buying property in Ranchi: a first-timer's guide",
      slug: SLUG,
      excerpt:
        "New to Ranchi's property market? A practical walk-through of choosing a locality, checking paperwork, comparing on carpet area, and contacting dealers directly.",
      content: CONTENT,
      cityId: ranchi?._id,
      tags: ["ranchi", "buying-guide", "first-time-buyer"],
      metaTitle: "Buying Property in Ranchi - A First-Timer's Guide",
      metaDescription:
        "How to buy property in Ranchi: picking the right locality, the paperwork to check, comparing on carpet area, and contacting verified dealers directly on WhatsApp.",
      status: "published",
    });
    console.log(`✓ Created demo blog post (/blog/${SLUG}).`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("✖ seed-demo-blog failed:", e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
