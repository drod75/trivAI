<a name="readme-top"></a>
<div align="center">

  <h1 align="center">TrivAI</h1>

  <p align="center">
    A Kahoot-style trivia game powered by generative AI, created for SBU Hacks 2025.
    <br />
    <a href="https://github.com/drod75/trivAI"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/drod75/trivAI">View Demo</a>
    ·
    <a href="https://github.com/drod75/trivAI/issues">Report Bug</a>
    ·
    <a href="https://github.com/drod75/trivAI/issues">Request Feature</a>
  </p>
</div>

<div align="center">

[![Stargazers][stars-shield]][stars-url]
[![Forks][forks-shield]][forks-url]
[![Issues][issues-shield]][issues-url]

</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#demo">Demo</a></li>
    <li><a href="#system-diagram">System Diagram</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

## About The Project

**TrivAI** is a submission for [SBU Hacks](https://hack.sbcs.io/), a hackathon hosted by the Stony Brook Computing Society.

This project is a Kahoot clone powered by generative AI. It showcases how artificial intelligence can revolutionize the creation and scaling of applications, challenging the often high costs of popular platforms. By simply providing a topic, TrivAI instantly generates a unique and engaging trivia game, demonstrating a new paradigm for accessible and dynamic educational technology.

Our goal is to highlight the potential of AI to democratize software development and combat unfair pricing in the market.

Our site is here! [trivAI](https://triviakahoot.me/)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

This project was brought to life with these amazing technologies:

*   [![Next][Next.js]][Next-url]
*   [![React][React.js]][React-url]
*   [![Tailwind][TailwindCSS]][Tailwind-url]
*   [![FastAPI][FastAPI]][FastAPI-url]
*   [![Python][Python]][Python-url]
*   [![Gemini][Gemini]][Gemini-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

Make sure you have the following installed:
*   **Node.js** (which includes npm)
    ```sh
    # Download and install from the official website
    https://nodejs.org/
    ```
*   **Python 3.13+**
    ```sh
    # Download and install from the official website
    https://www.python.org/
    ```

### Installation

1.  **Clone the repo**
    ```sh
    git clone https://github.com/drod75/trivAI.git
    cd trivAI
    ```
2.  **Set up the Frontend**
    ```sh
    cd frontend
    npm install
    ```
3.  **Set up the Backend**
    ```sh
    cd ../backend
    pip install -r requirements.txt
    ```
4.  **API Keys**
    Create a `.env` file in the `backend` directory and add your Google Gemini API key:
    ```
    GOOGLE_API_KEY='YOUR_API_KEY'
    ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

1.  **Run the Backend Server**
    From the `backend` directory:
    ```sh
    uvicorn main:app --reload --host 127.0.0.1 --port 8000
    ```
2.  **Run the Frontend Application**
    From the `frontend` directory:
    ```sh
    npm run dev
    ```
Open your browser and navigate to `http://localhost:3000` to see the application in action.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Demo

A video demonstration will be available here soon. Stay tuned!

[Youtube Video Demo](https://youtu.be/CeCjq_sqY_g)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

Project Link: [https://github.com/drod75/trivAI](https://github.com/drod75/trivAI)

**Team:**
*   **David Rodriguez** - [LinkedIn](https://www.linkedin.com/in/david-rodriguez-nyc/)
*   **Mukhammadali Yuldoshev** - [LinkedIn](https://www.linkedin.com/in/mukhammadali-yuldoshev)
*   **Faizan Khan** - [LinkedIn](https://www.linkedin.com/in/faizan-khan234)
*   **Zain Raza** - [LinkedIn](https://www.linkedin.com/in/zainraza730)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

[stars-shield]: https://img.shields.io/github/stars/drod75/trivAI.svg?style=for-the-badge
[stars-url]: https://github.com/drod75/trivAI/stargazers
[forks-shield]: https://img.shields.io/github/forks/drod75/trivAI.svg?style=for-the-badge
[forks-url]: https://github.com/drod75/trivAI/network/members
[issues-shield]: https://img.shields.io/github/issues/drod75/trivAI.svg?style=for-the-badge
[issues-url]: https://github.com/drod75/trivAI/issues
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://www.linkedin.com/in/david-rodriguez-nyc/
[product-screenshot]: public/logo.png
[Next.js]: https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[TailwindCSS]: https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white
[Tailwind-url]: https://tailwindcss.com/
[FastAPI]: https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi
[FastAPI-url]: https://fastapi.tiangolo.com/
[Python]: https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white
[Python-url]: https://www.python.org/
[Gemini]: https://img.shields.io/badge/Gemini_API-4A89F3?style=for-the-badge&logo=google&logoColor=white
[Gemini-url]: https://ai.google.dev/
