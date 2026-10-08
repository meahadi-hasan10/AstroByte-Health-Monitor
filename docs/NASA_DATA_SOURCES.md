# NASA Data Source

**Project:** AstroByte Health Monitor  
**Team:** Team AstroByte

## NASA Data Source

**Source:** NASA Open Science Data Repository (OSDR) — RadLab Space Radiation Telemetry

**Official API:** https://visualization.osdr.nasa.gov/radlab/gui/data-api/

**OSDR Overview:** https://science.nasa.gov/biological-physical/data/osdr/

## Data Integration

The optional Flask endpoint `GET /api/nasa/radiation` attempts to retrieve historical ISS/DosTel radiation data (April 1–2, 2022) from NASA RadLab. When available, the retrieved data is displayed separately in the NASA Data section.

## Data Usage and Limitations

- **Simulated Data:** Heart rate, SpO₂, temperature, sleep, fatigue, and adjustable radiation values use synthetic demonstration inputs.
- **Risk Analysis:** Risk scores and health trends are illustrative calculations.
- **NASA Integration:** Historical NASA radiation readings are not automatically included in risk-score calculations. Live API retrieval has not yet been verified.

RadLab provides a reference for incorporating space-radiation environmental context into future astronaut health monitoring systems.