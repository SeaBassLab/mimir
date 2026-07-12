import type { KnowledgeFact, KnowledgeGraphReader, KnowledgePredicate } from "./model";

export class KnowledgeGraph implements KnowledgeGraphReader {
  private readonly collectedFacts: KnowledgeFact[] = [];

  add(facts: readonly KnowledgeFact[]): void {
    this.collectedFacts.push(...facts);
  }

  facts(predicate?: KnowledgePredicate): readonly KnowledgeFact[] {
    return predicate
      ? this.collectedFacts.filter((fact) => fact.predicate === predicate)
      : this.collectedFacts;
  }

  factsFor(subject: string, predicate?: KnowledgePredicate): readonly KnowledgeFact[] {
    return this.collectedFacts.filter(
      (fact) => fact.subject === subject && (!predicate || fact.predicate === predicate)
    );
  }

  resources(): readonly KnowledgeFact[] {
    return this.facts("resource");
  }

  relationships(subject?: string): readonly KnowledgeFact[] {
    return subject ? this.factsFor(subject, "relationship") : this.facts("relationship");
  }

  examples(subject?: string): readonly KnowledgeFact[] {
    return subject ? this.factsFor(subject, "example") : this.facts("example");
  }

  publicApi(subject: string): KnowledgeFact | undefined {
    return this.factsFor(subject, "public-api")[0];
  }

  classification(subject: string): KnowledgeFact | undefined {
    return this.factsFor(subject, "classification")[0];
  }
}
