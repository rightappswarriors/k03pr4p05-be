import { core } from "nexus";

declare global {
  interface NexusGenCustomInputMethods<TypeName extends string> {
    dateTime<FieldName extends string>(
      fieldName: FieldName,
      opts?: core.CommonInputFieldConfig<TypeName, FieldName>
    ): void;
    json<FieldName extends string>(
      fieldName: FieldName,
      opts?: core.CommonInputFieldConfig<TypeName, FieldName>
    ): void;
  }
}

declare global {
  interface NexusGenCustomOutputMethods<TypeName extends string> {
    dateTime<FieldName extends string>(
      fieldName: FieldName,
      opts?: core.ScalarOutSpread<TypeName, FieldName>
    ): void;
    json<FieldName extends string>(
      fieldName: FieldName,
      opts?: core.ScalarOutSpread<TypeName, FieldName>
    ): void;
  }
}
