# AI Usage

**Project:** AstroByte Health Monitor  
**Team:** Team AstroByte

- **Development Assistance:** ChatGPT (OpenAI) assisted with prototype code, interface design, and documentation. The team reviewed and adapted the results. Development prompts focused on astronaut health monitoring, simulated telemetry, explainable alerts, and documentation.

- **Health Analysis:** `engine.js` uses transparent, rule-based scoring and explanations with synthetic inputs. It is not a trained medical AI model.

- **Optional AI Insights:** The deployed prototype currently provides rule-based health explanations (`mode: local`). The Flask backend (`app.py`) also supports non-diagnostic summaries through the OpenAI API when a server-side `OPENAI_API_KEY` is configured. The implemented AI instructions are available in `app.py`.

**Disclosure:** AI-generated media used in our prescreening video is credited in the video's end credits. This prototype is intended for demonstration and decision support, not medical diagnosis.
