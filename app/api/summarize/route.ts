import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const activities = body.activities;

    if (!activities || !Array.isArray(activities)) {
      return Response.json(
        { error: "Activities are required" },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5.6",
      instructions: `
You are the intelligence layer for an app called Resume.

Resume helps users continue work after switching tasks.

Analyze the user's recent activity and determine:

1. A short title for the task
2. What the user was working on
3. 2 to 4 important things worth remembering
4. The most likely next step

Return ONLY valid JSON in this exact format:

{
  "title": "Task title",
  "workingOn": "One sentence describing what the user was doing.",
  "remembers": [
    "Important detail 1",
    "Important detail 2"
  ],
  "nextStep": "The most likely next action."
}
`,
      input: JSON.stringify(activities, null, 2),
    });

    const resumePoint = JSON.parse(response.output_text);

    return Response.json(resumePoint);
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Failed to create Resume Point" },
      { status: 500 }
    );
  }
}