export const DEFAULT_NDA_TITLE = "Confidentiality and Non-Disclosure Agreement";

export function defaultNdaBody(roomName: string, ownerName: string): string {
  return `This Confidentiality and Non-Disclosure Agreement (the "Agreement") is entered into between ${ownerName} (the "Disclosing Party") and the individual accepting this Agreement (the "Recipient") in connection with access to the data room "${roomName}".

1. Confidential Information. "Confidential Information" means all documents, data, materials and information made available to the Recipient through the data room, in any form, whether or not marked as confidential.

2. Obligations. The Recipient agrees to (a) hold the Confidential Information in strict confidence; (b) use it solely for the purpose of evaluating a potential transaction or relationship with the Disclosing Party; (c) not disclose it to any third party without the prior written consent of the Disclosing Party; and (d) not copy, download, photograph, screenshot or otherwise reproduce any Confidential Information except as expressly permitted within the data room.

3. Exclusions. Confidential Information does not include information that (a) is or becomes publicly available through no fault of the Recipient; (b) was rightfully known to the Recipient before disclosure; or (c) is independently developed without use of the Confidential Information.

4. Monitoring. The Recipient acknowledges that access to the data room is logged, including documents opened, time spent reviewing each document and downloads, and that documents may carry a watermark identifying the Recipient.

5. Return or Destruction. Upon request of the Disclosing Party, the Recipient will promptly destroy or return all Confidential Information in its possession.

6. Term. The obligations in this Agreement remain in effect for three (3) years from the date of acceptance.

7. Remedies. The Recipient acknowledges that unauthorised disclosure may cause irreparable harm for which monetary damages would be inadequate, and that the Disclosing Party is entitled to seek injunctive relief in addition to any other remedies.

8. Electronic Acceptance. By typing their name and confirming acceptance, the Recipient agrees to be legally bound by this Agreement, and agrees that this electronic acceptance has the same effect as a handwritten signature.`;
}
