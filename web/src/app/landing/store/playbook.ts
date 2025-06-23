// Copyright (c) 2025 YADRA

export const playbook = {
  steps: [
    {
      description:
        "The Generalmanager is responsible for engaging with the user to understand their problem and requirements.",
      activeNodes: ["Start", "Generalmanager"],
      activeEdges: ["Start->Generalmanager"],
      tooltipPosition: "right",
    },
    {
      description:
        "If the user's problem is clearly defined, the Generalmanager will hand it over to the Projectmanager.",
      activeNodes: ["Generalmanager", "Projectmanager"],
      activeEdges: ["Generalmanager->Projectmanager"],
      tooltipPosition: "left",
    },
    {
      description: "Awaiting human feedback to refine the plan.",
      activeNodes: ["Projectmanager", "HumanFeedback"],
      activeEdges: ["Projectmanager->HumanFeedback"],
      tooltipPosition: "left",
    },
    {
      description: "Updating the plan based on human feedback.",
      activeNodes: ["HumanFeedback", "Projectmanager"],
      activeEdges: ["HumanFeedback->Projectmanager"],
      tooltipPosition: "left",
    },
    {
      description:
        "The Research Team is responsible for conducting the core research tasks.",
      activeNodes: ["Projectmanager", "HumanFeedback", "ResearchTeam"],
      activeEdges: [
        "Projectmanager->HumanFeedback",
        "HumanFeedback->ResearchTeam",
        "ResearchTeam->HumanFeedback",
      ],
      tooltipPosition: "left",
    },
    {
      description:
        "The Researcher is responsible for gathering information using search and crawling tools.",
      activeNodes: ["ResearchTeam", "Researcher"],
      activeEdges: ["ResearchTeam->Researcher", "Researcher->ResearchTeam"],
      tooltipPosition: "left",
    },
    {
      description:
        "The Coder is responsible for writing Python code to solve math problems, data analysis, and more.",
      tooltipPosition: "right",
      activeNodes: ["ResearchTeam", "Coder"],
      activeEdges: ["ResearchTeam->Coder", "Coder->ResearchTeam"],
    },
    {
      description:
        "Once the research tasks are completed, the Researcher will hand over to the Projectmanager.",
      activeNodes: ["ResearchTeam", "Projectmanager"],
      activeEdges: ["ResearchTeam->Projectmanager"],
      tooltipPosition: "left",
    },
    {
      description:
        "If no additional information is required, the Projectmanager will handoff to the Reporter.",
      activeNodes: ["Reporter", "Projectmanager"],
      activeEdges: ["Projectmanager->Reporter"],
      tooltipPosition: "right",
    },
    {
      description:
        "The Reporter will prepare a report summarizing the results.",
      activeNodes: ["End", "Reporter"],
      activeEdges: ["Reporter->End"],
      tooltipPosition: "bottom",
    },
  ],
};
