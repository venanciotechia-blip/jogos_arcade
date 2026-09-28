import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

interface TargetPersonData {
  name: string;
  era: string;
  field: string;
  nationality: string;
  gender: string;
  keyFacts: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetPerson, question, isGuess } = body as {
      targetPerson: TargetPersonData;
      question: string;
      isGuess?: boolean;
    };

    if (!targetPerson || !question) {
      return NextResponse.json(
        { error: "Dados incompletos fornecidos." },
        { status: 400 }
      );
    }

    const cleanQuestion = question.trim();

    // Check if GEMINI_API_KEY is available
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const systemPrompt = `Você é o oráculo neutro e rigoroso do jogo "Quem Sou Eu? - Adivinhe a Figura Histórica".
A figura secreta atual que o jogador tenta descobrir é:
- Nome: ${targetPerson.name}
- Época/Século: ${targetPerson.era}
- Área de Atuação: ${targetPerson.field}
- Nacionalidade/Origem: ${targetPerson.nationality}
- Gênero: ${targetPerson.gender}
- Fatos Notáveis: ${targetPerson.keyFacts}

REGRAS ESTRITAS:
1. Se isGuess for true, o jogador está tentando adivinhar quem é a pessoa:
   - Se o palpite for a figura secreta (${targetPerson.name} ou variação reconhecida do nome, ex: Einstein para Albert Einstein), o verdict deve ser "ACERTOU!".
   - Caso contrário, o verdict deve ser "ERROU O PALPITE!".
2. Se isGuess for false, o jogador fez uma pergunta de SIM ou NÃO sobre essa figura histórica:
   - Responda com um dos seguintes verdicts exatos:
     * "SIM"
     * "NÃO"
     * "PROVAVELMENTE SIM"
     * "PROVAVELMENTE NÃO"
     * "NÃO SE APLICA" (caso a pergunta não faça sentido para a época ou pessoa)
3. Forneça uma observação ('detail') curta e precisa de 1 frase no máximo em português, sem revelar o nome da figura histórica a não ser que tenha acertado o palpite!
4. Responda ESTRITAMENTE em formato JSON com o seguinte formato:
{
  "verdict": "SIM" | "NÃO" | "PROVAVELMENTE SIM" | "PROVAVELMENTE NÃO" | "NÃO SE APLICA" | "ACERTOU!" | "ERROU O PALPITE!",
  "isCorrect": boolean,
  "detail": "Frase explicativa concisa e divertida"
}`;

        const prompt = `Pergunta / Palpite do jogador: "${cleanQuestion}"\nisGuess: ${Boolean(isGuess)}`;

        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        });

        const textOutput = response.text?.trim() || "";
        if (textOutput) {
          const parsed = JSON.parse(textOutput);
          return NextResponse.json({
            verdict: parsed.verdict || "SIM",
            isCorrect: Boolean(parsed.isCorrect),
            detail: parsed.detail || "",
            source: "gemini",
          });
        }
      } catch (geminiError) {
        console.warn("Gemini API fallback to local rule engine:", geminiError);
      }
    }

    // Local heuristic fallback if offline or no key
    const normalizedTarget = targetPerson.name.toLowerCase();
    const normalizedQuestion = cleanQuestion.toLowerCase();

    if (isGuess) {
      const parts = normalizedTarget.split(" ");
      const isMatch =
        normalizedQuestion.includes(normalizedTarget) ||
        parts.some((p) => p.length > 3 && normalizedQuestion.includes(p));

      if (isMatch) {
        return NextResponse.json({
          verdict: "ACERTOU!",
          isCorrect: true,
          detail: `Exato! A figura histórica misteriosa é de fato ${targetPerson.name}!`,
          source: "fallback",
        });
      } else {
        return NextResponse.json({
          verdict: "ERROU O PALPITE!",
          isCorrect: false,
          detail: "Não é essa pessoa histórica! Continue perguntando para afunilar as pistas.",
          source: "fallback",
        });
      }
    }

    // Heuristic rule matching for common questions
    const q = normalizedQuestion;
    let verdict = "NÃO";
    let detail = "";

    // Gender check
    if (q.includes("mulher") || q.includes("feminino")) {
      verdict = targetPerson.gender === "Feminino" ? "SIM" : "NÃO";
      detail = verdict === "SIM" ? "É uma mulher notável da história." : "Não é do gênero feminino.";
    } else if (q.includes("homem") || q.includes("masculino")) {
      verdict = targetPerson.gender === "Masculino" ? "SIM" : "NÃO";
      detail = verdict === "SIM" ? "É do gênero masculino." : "Não é do gênero masculino.";
    } else if (q.includes("vivo") || q.includes("viva") || q.includes("está vivo") || q.includes("ainda vive")) {
      verdict = "NÃO";
      detail = "Esta grande figura histórica já faleceu.";
    } else if (q.includes("nobel")) {
      const facts = targetPerson.keyFacts.toLowerCase();
      verdict = facts.includes("nobel") ? "SIM" : "NÃO";
      detail = verdict === "SIM" ? "Recebeu a prestigiada láurea do Prêmio Nobel!" : "Não recebeu o Prêmio Nobel.";
    } else if (q.includes("brasil") || q.includes("brasileir")) {
      const nat = targetPerson.nationality.toLowerCase();
      verdict = nat.includes("brasil") ? "SIM" : "NÃO";
      detail = verdict === "SIM" ? "Tem profunda ligação e origem com o Brasil!" : "Não é de nacionalidade brasileira.";
    } else if (q.includes("europa") || q.includes("europeu") || q.includes("europeia")) {
      const nat = targetPerson.nationality.toLowerCase();
      const europeKeywords = ["alem", "franc", "ingl", "brit", "ital", "gre", "polon", "russ", "espanh", "austr", "portug"];
      verdict = europeKeywords.some((k) => nat.includes(k)) ? "SIM" : "NÃO";
      detail = verdict === "SIM" ? "Viveu ou atuou predominantemente no continente europeu." : "Não tem suas origens primárias na Europa.";
    } else if (q.includes("ciência") || q.includes("cientist") || q.includes("físic") || q.includes("químic") || q.includes("matemátic")) {
      const field = targetPerson.field.toLowerCase();
      verdict = field.includes("ciência") || field.includes("física") || field.includes("química") || field.includes("matemática") || field.includes("astronomia") ? "SIM" : "NÃO";
      detail = verdict === "SIM" ? "Teve papel revolucionário nas ciências exatas ou naturais." : "Seu legado principal está em outra esfera.";
    } else if (q.includes("arte") || q.includes("pintor") || q.includes("escultor") || q.includes("músic") || q.includes("literat") || q.includes("livro") || q.includes("escritor")) {
      const field = targetPerson.field.toLowerCase();
      verdict = field.includes("arte") || field.includes("música") || field.includes("literatura") || field.includes("pintura") ? "SIM" : "NÃO";
      detail = verdict === "SIM" ? "É um dos maiores nomes das artes e cultura humana." : "Sua atuação não foi primordialmente artística.";
    } else if (q.includes("polític") || q.includes("líder") || q.includes("presidente") || q.includes("rei") || q.includes("imperador") || q.includes("governo")) {
      const field = targetPerson.field.toLowerCase();
      verdict = field.includes("política") || field.includes("liderança") || field.includes("militar") || field.includes("império") ? "SIM" : "NÃO";
      detail = verdict === "SIM" ? "Foi uma liderança política/estatal de grande impacto mundial." : "Não governou nação nem teve carreira política central.";
    } else if (q.includes("século xx") || q.includes("1900") || q.includes("século 20")) {
      const era = targetPerson.era.toLowerCase();
      verdict = era.includes("xx") || era.includes("19") ? "SIM" : "NÃO";
      detail = verdict === "SIM" ? "Viveu e atuou durante o século XX." : "Pertence a outra época histórica.";
    } else {
      // General question fallback
      verdict = targetPerson.keyFacts.toLowerCase().includes(q.slice(0, 5)) ? "SIM" : "NÃO";
      detail = "Análise histórica processada com sucesso.";
    }

    return NextResponse.json({
      verdict,
      isCorrect: false,
      detail,
      source: "fallback",
    });
  } catch (error) {
    console.error("Historical Guess API Error:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar a pergunta histórica." },
      { status: 500 }
    );
  }
}
