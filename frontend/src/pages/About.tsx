import React from "react";
import { Link } from "react-router-dom";

function About(): React.ReactElement {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            <div className="max-w-5xl mx-auto px-6 py-12">
                {/* Header Section */}
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                        About NotSharp
                    </h1>
                    <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto rounded-full"></div>
                </div>

                {/* Main Content */}
                <div className="space-y-8">
                    {/* Mission Card */}
                    <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 hover:shadow-xl transition-shadow duration-300">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-3">STEM-Oriented Functionality</h2>
                                <p className="text-lg text-gray-600 leading-relaxed">
                                    NotSharp is designed with STEM professionals in mind, offering support for LaTeX math notation, 
                                    code block highlighting, structured diagrams (e.g., class diagrams, flowcharts, Fourier transforms), 
                                    and markdown-based notes. This tool provides a unified workspace for students, small teams, creatives, 
                                    and technical professionals to ideate, structure, and collaborate.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Features Card */}
                    <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 hover:shadow-xl transition-shadow duration-300">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-3">Unified Collaboration Platform</h2>
                                <p className="text-lg text-gray-600 leading-relaxed">
                                    With NotSharp, you can create a unified digital collaboration and design tool that bridges the gap 
                                    between technical and creative workflows, enabling seamless integration between computer science/engineering 
                                    and creative professionals (artists, illustrators, designers, mathematicians). The platform offers specialized 
                                    and general tools to meet diverse user needs, featuring an intuitive design and a "pay for what you use" 
                                    pricing structure for accessibility and flexibility. Organize notes, create diagrams, and make comprehensive 
                                    flowcharts, mood boards, and more with simple, easy-to-use tools that are both flexible and powerful.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Vision Card */}
                    <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg p-8 text-white hover:shadow-xl transition-shadow duration-300">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold mb-3">Our Vision</h2>
                                <p className="text-lg leading-relaxed text-white/90">
                                    NotSharp aims to revolutionize how individuals and teams approach project planning, brainstorming, 
                                    and documentation by providing a versatile platform that caters to both technical and creative processes.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* CTA Section */}
                    <div className="text-center pt-8">
                        <Link 
                            to="/" 
                            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Get Started with NotSharp
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default About;
