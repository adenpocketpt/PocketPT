import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";

// ---- load env & clients
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// ---- load files from /lib
const SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "lib", "pocketpt.system.md"),
  "utf8"
);
const PLAN_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "lib", "plan.schema.json"), "utf8")
);
const INTAKE_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "lib", "intake.schema.json"), "utf8")
);

// ---- validate intake before calling OpenAI
const ajv = new Ajv({ allErrors: true, strict: true });
const validateIntake = ajv.compile(INTAKE_SCHEMA);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // body can be JSON object or stringified JSON depending on client
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const intake = body?.intake;

    if (!intake || !validateIntake(intake)) {
      return res.status(400).json({
        error: "Invalid intake payload",
        details: validateIntake.errors || "Missing `intake`"
      });
    }

    // ---- call Responses API with JSON Schema forcing output shape
    const resp = await client.responses.create({
      model: "gpt-5.1", // use your best available text model
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(intake) }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "PocketPTPlan",
          schema: PLAN_SCHEMA,
          // strict true = model must comply with the schema
          strict: true
        }
      }
    });

    // ---- extract JSON plan
    const first = resp.output?.[0];
    if (!first || first.type !== "output_text") {
      return res.status(500).json({ error: "No structured plan returned" });
    }
    const plan = JSON.parse(first.text);

    return res.status(200).json({ plan });
