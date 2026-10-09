# NASA Data Source

**Project:** AstroByte Health Monitor  
**Team:** Team AstroByte

## NASA Data Source

**Source:** NASA Open Science Data Repository (OSDR) — RadLab Space Radiation Telemetry

**Official API:** https://visualization.osdr.nasa.gov/radlab/gui/data-api/

**OSDR Overview:** https://science.nasa.gov/biological-physical/data/osdr/

## Data Integration

The Flask endpoint `GET /api/nasa/radiation` retrieves historical ISS/DosTel radiation data (April 1–2, 2022) from NASA RadLab.

**Verification:** Successfully tested on 9 October 2026. The API returned 180 historical records, and 45 sampled radiation measurements were displayed in the website's radiation chart.

## Data Usage and Limitations

- **Simulated Data:** Heart rate, SpO₂, temperature, sleep, fatigue, and adjustable radiation values use synthetic demonstration inputs.
- **Risk Analysis:** Risk scores and health trends are illustrative calculations.
- **NASA Integration:** Historical NASA radiation measurements are displayed separately and are not automatically included in risk-score calculations. The integration uses historical data, not real-time astronaut telemetry.

RadLab provides environmental radiation context for exploring future astronaut health monitoring applications.
