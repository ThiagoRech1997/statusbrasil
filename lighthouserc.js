/** @type {import('@lhci/cli').LighthouseRcConfig} */
module.exports = {
  ci: {
    collect: {
      url: [
        "http://localhost:3000/pt",
        "http://localhost:3000/pt/ranking",
        "http://localhost:3000/pt/comparativo",
        "http://localhost:3000/pt/servico/gov-br",
        "http://localhost:3000/pt/incidentes",
        "http://localhost:3000/pt/metodologia",
      ],
      numberOfRuns: 1,
      settings: {
        // mobile slow-3G (Lighthouse preset)
        formFactor: "mobile",
        throttlingMethod: "simulate",
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
        },
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 823,
          deviceScaleFactor: 1.75,
          disabled: false,
        },
        // skip storage reset between pages to speed up CI
        disableStorageReset: true,
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./lhci-reports",
    },
  },
};
