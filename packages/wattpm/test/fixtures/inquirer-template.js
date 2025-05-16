const expected = []

export function prompt (questions) {
  const replies = {}

  if (!Array.isArray(questions)) {
    questions = [questions]
  }

  for (const question of questions) {
    const next = expected.shift()

    // Check we have the expected question
    if (!next) {
      throw new Error(`Unexpected question: ${JSON.stringify(question, null, 2)}`)
    } else if (next.type !== question.type || next.question !== question.message) {
      throw new Error(
        `Expected ${next.type} question "${next.question}" but got ${question.type} "${question.message}".`
      )
    }

    let reply = next.reply
    if (question.choices) {
      const match = question.choices.find(choice => (choice?.name ?? choice) === reply)

      // If we have choices, verify the answer
      if (!match) {
        throw new Error(`Unsupported reply "${reply}": ${JSON.stringify(question, null, 2)}`)
      }

      reply = match.value ?? match

      console.log(`? ${question.message} ${reply}`)
      for (const choice of question.choices) {
        const selected = (choice?.name ?? choice) === next.reply ? '>' : ' '

        if (typeof choice === 'string') {
          console.log(`${selected} ${choice}`)
        } else {
          console.log(`${selected} ${choice.name} (${choice.value})`)
        }
      }
    } else {
      // No choices, all good
      console.log(`? ${question.message} ${reply}`)
    }

    replies[question.name] = reply
  }

  return replies
}
